import { useCallback, useEffect, useRef, useState } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { newToast } from "./util/toast";
import io from "socket.io-client";
import usersData from "../../server/data/users.json";

function App() {
  const [hasNavigated, setHasNavigated] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const messageRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [isAtHome, setIsAtHome] = useState(true);
  const [currentRoom, setCurrentRoom] = useState("home");
  const [currentRoomName, setCurrentRoomName] = useState("home");
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState("");
  const [socket, setSocket] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFileInput, setShowFileInput] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const typingTimeoutRef = useRef();

  const navigate = useNavigate();
  const currentUser = localStorage.getItem("username");
  const user = usersData.find((user) => user.username === currentUser);
  const currentUserId = user ? user.userId : null;

  useEffect(() => {
    if (!hasNavigated) {
      navigate("/");
      setHasNavigated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUserAtBottom = () => {
    return (
      messagesEndRef.current &&
      messagesEndRef.current.scrollHeight - messagesEndRef.current.scrollTop ===
        messagesEndRef.current.clientHeight
    );
  };

  const handleInput = useCallback(() => {
    const username = localStorage.getItem("username");
    if (!isTyping && username) {
      setIsTyping(true);
      socket.emit("start_typing", username);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setTypingUser("");
      if (username) {
        socket.emit("stop_typing", username);
      }
    }, 3000);
  }, [isTyping, socket]);

  useEffect(() => {
    if (message !== "") {
      setIsTyping(true);
    }
  }, [message]);

  useEffect(() => {
    if (socket) {
      let typingTimeout;

      socket.on("typing", (username) => {
        if (username && username !== currentUser) {
          setIsTyping(true);
          setTypingUser(username);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => setIsTyping(false), 3000);
        } else {
          setIsTyping(false);
          setTypingUser("");
        }
      });

      socket.on("user_disconnected", (username) => {
        if (username === typingUser) {
          clearTimeout(typingTimeout);
          setIsTyping(false);
          setTypingUser("");
        }
      });

      socket.on("room_messages", (roomMessages) => {
        setMessages(roomMessages);
      });

      socket.on("friend_request_response", ({ accepted, senderId }) => {
        if (accepted) {
          setFriends((prevFriends) => [...prevFriends, senderId]);
          newToast("Success!", "Friend request accepted!", "info");
        } else {
          newToast("Error!", "Friend request rejected", "error");
        }
      });

      socket.on(
        "friend_request",
        ({ senderId, senderUsername, recipientId }) => {
          if (currentUserId === recipientId) {
            setFriendRequests((prevRequests) => [
              ...prevRequests,
              {
                id: senderId,
                username: senderUsername,
                recipientId,
              },
            ]);
          }
        }
      );

      return () => {
        socket.off("typing");
        socket.off("user_disconnected");
        socket.off("room_messages");
      };
    }
  }, [socket, currentUser, typingUser, currentUserId]);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file.size > 8 * 2048 * 2048) {
      newToast(
        "Error!",
        "File size is too large. Please select a file smaller than 8 MB.",
        "error"
      );
      return;
    }

    const img = new Image();
    img.onload = function () {
      if (this.width > 1024 || this.height > 1024) {
        newToast(
          "Error!",
          "Image dimensions are too large. Please select an image smaller than 1024x1024 pixels.",
          "error"
        );
        return;
      }

      setSelectedFile(file);
      setFileSelected(true);
    };
    img.src = URL.createObjectURL(file);
  };

  const changePfp = () => {
    if (selectedFile) {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("userId", currentUserId);

      fetch("http://localhost:8080/api/users/uploads", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            newToast("Done!", "Your new profile picture is set", "info");
            localStorage.setItem("pfp", data.pfp);
          } else {
            newToast("Error!", "Failed to upload image", "error");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          newToast("Error!", "Failed to upload image", "error");
        });
    } else {
      newToast("Error!", "No file selected", "error");
    }
  };

  const handleClick = () => {
    setShowFileInput(true);
  };

  useEffect(() => {
    const s = io("http://127.0.0.1:8080");
    setSocket(s);

    if (s) {
      s.on("message", (messageObject) => {
        setMessages((prevMessages) => [...prevMessages, messageObject]);

        const userAtBottom = isUserAtBottom();
        if (userAtBottom) {
          setTimeout(() => {
            scrollToBottom();
          }, 0);
        }
      });

      s.on("room_invitation", ({ room, userId }) => {
        const currentUser = localStorage.getItem("username");
        const user = usersData.find((user) => user.username === currentUser);
        const currentUserId = user ? user.userId : null;

        if (userId === currentUserId) {
          setRooms((oldRooms) => {
            const roomIndex = oldRooms.findIndex(
              (oldRoom) => oldRoom.id === room.id
            );
            if (roomIndex !== -1) {
              const updatedRooms = [...oldRooms];
              updatedRooms[roomIndex] = room;
              updatedRooms[roomIndex].members.push(userId);
              return updatedRooms;
            } else {
              room.members.push(userId);
              return [...oldRooms, room];
            }
          });
        }
      });

      s.on("existing_messages", (existingMessages) => {
        setMessages(existingMessages);
        setTimeout(() => {
          scrollToBottom();
        }, 0);
      });

      s.on("start_typing", (username) => {
        setTypingUser(username);
      });

      s.on("stop_typing", (username) => {
        if (typingUser === username) {
          setTypingUser("");
        }
      });

      s.on("edit_message", (editedMessage) => {
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === editedMessage.id ? editedMessage : msg
          )
        );
      });

      s.on("delete_message", (messageId) => {
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== messageId)
        );
      });
    }

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [typingUser]);

  const newRoomContainer = document.querySelector(".addRoomContainer");

  const removeRoomModal = () => {
    newRoomContainer.style.display = "none";
  };

  const inviteModal = document.querySelector(".inviteModal");

  const removeInviteModal = () => {
    if (inviteModal) {
      setShowInviteModal(false);
    }
  };

  const handleJoinRoom = (roomId, roomName) => {
    if (currentRoom) {
      socket.emit("leave_room", currentRoom);
    }

    socket.emit("join_room", roomId);
    socket.emit("get_room_messages", roomId);
    setCurrentRoom(roomId);
    setCurrentRoomName(roomName);
    navigate(`/rooms/${roomId}`);
  };

  const handleJoinHome = () => {
    if (!isAtHome) return;
    setCurrentRoom("home");
    setIsAtHome(true);
    navigate("/");
  };

  const handleAddRoomSettings = () => {
    const newRoomInput = document.querySelector(".addRoomInput");
    newRoomInput.style.display = "block";
    newRoomContainer.style.display = "block";
  };

  const handleAddRoom = (roomName) => {
    if (!currentUserId) {
      newToast("Error!", "You must be logged in to create a room", "error");
      return;
    }
    const newRoom = {
      id: uuidv4(),
      name: roomName,
      members: [currentUserId],
    };

    fetch("http://localhost:8080/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newRoom),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          socket.emit("add_room", newRoom);
          setRooms((oldRooms) => [...oldRooms, newRoom]);
        } else {
          console.error("Failed to create room");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  };

  const handleInviteClick = () => {
    const inviteModal = document.querySelector(".inviteModal");
    setShowInviteModal(true);
    if (inviteModal) {
      inviteModal.style.display = "block";
    }
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    const room = rooms.find((room) => room.id === currentRoom);
    const userToInvite = usersData.find(
      (user) => user.username === inviteUsername
    );
    if (userToInvite && room.members.includes(userToInvite.userId)) {
      newToast("Error!", "User is already in the room", "error");
      return;
    }
    fetch(`http://localhost:8080/api/invite/${currentRoom}/${inviteUsername}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          newToast("Done!", `User has been invited`, "info");
        } else {
          newToast("Error!", data.message, "error");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        newToast("Error!", "Failed to invite user", "error");
      });
    setInviteUsername("");
    setShowInviteModal(false);
  };

  useEffect(() => {
    fetch("http://localhost:8080/api/rooms")
      .then((response) => response.json())
      .then((data) => {
        setRooms(data.rooms);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }, []);

  const handleAddFriendClick = () => {
    setShowAddFriendModal(true);
  };

  const removeAddFriendModal = () => {
    setShowAddFriendModal(false);
  };

  const handleAddFriend = (friendUsername) => {
    if (friendUsername === currentUser) {
      newToast(
        "Error!",
        "You can't send a friend request to yourself",
        "error"
      );
      return;
    }
    const friend = usersData.find((user) => user.username === friendUsername);
    if (!friend) {
      newToast("Error!", "User not found", "error");
    } else {
      const existingRequest = friendRequests.find(
        (request) => request.username === friendUsername
      );
      if (existingRequest) {
        newToast("Error!", "Friend request already sent to this user", "error");
      } else {
        socket.emit("friend_request", {
          senderId: currentUserId,
          senderUsername: currentUser,
          recipientId: friend.userId,
        });
        newToast("Success!", "Friend request sent!", "info");
        setFriendRequests((prevRequests) => [
          ...prevRequests,
          { id: friend.userId, username: friendUsername },
        ]);
      }
    }
  };

  const handleFriendRequestResponse = (senderId, accepted, recipientId) => {
    if (accepted) {
      setFriends((prevFriends) => [...prevFriends, senderId]);
    }
    socket.emit("friend_request_response", {
      accepted,
      senderId,
      recipientId,
    });

    setFriendRequests((prevRequests) =>
      prevRequests.filter((request) => request.id !== senderId)
    );
  };

  const handleChange = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim() === "") {
        newToast("Error!", "Message cannot be empty or only spaces", "error");
      } else {
        sendMessage(message, currentRoom);
        setMessage("");
      }
    } else if (e.key === "Enter" && e.shiftKey) {
      const textarea = document.querySelector(".textBox");
      e.preventDefault();
      const cursorPosition = e.target.selectionStart;
      const newValue =
        message.slice(0, cursorPosition) + "\n" + message.slice(cursorPosition);
      if ((newValue.match(/\n/g) || []).length <= 10) {
        setMessage(newValue);
        setTimeout(() => {
          textarea.scrollTop = textarea.scrollHeight;
        }, 0);
      } else {
        newToast("Error!", "Maximum number of line breaks exceeded", "error");
      }
    } else {
      setMessage(e.target.value);
    }
  };

  const formatDate = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1
    );
    const messageDate = new Date(date);

    if (messageDate >= today) {
      return `Today at ${messageDate.getHours()}:${messageDate.getMinutes()}`;
    } else if (messageDate >= yesterday) {
      return `Yesterday at ${messageDate.getHours()}:${messageDate.getMinutes()}`;
    } else {
      return `${messageDate.getHours()}:${messageDate.getMinutes()} on ${messageDate.getDate()}/${
        messageDate.getMonth() + 1
      }/${messageDate.getFullYear()}`;
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  };

  const sendMessage = (message, roomId) => {
    const previousMessageUserId = messages[messages.length - 1]
      ? messages[messages.length - 1].userId
      : null;
    let username = localStorage.getItem("username");
    let pfp = localStorage.getItem("pfp");

    if (user) {
      pfp = user.pfp;
    }

    if (!username || username === "" || !pfp || pfp === "") {
      if (!username || username === "") {
        newToast("Error!", "Please set your username first", "error", 2500);
      }
      if (!pfp || pfp === "") {
        newToast(
          "Error!",
          "Please set your profile picture first",
          "error",
          2500
        );
      }
      return;
    }

    if (previousMessageUserId === currentUserId) {
      username = null;
      pfp = null;
    }

    const newMessage = {
      id: uuidv4(),
      userId: currentUserId,
      date: new Date(),
      roomId: roomId,
      pfp,
      username,
      message,
    };

    const userAtBottom = isUserAtBottom();
    socket.emit("message", newMessage, roomId);
    setMessages((prevMessages) => [...prevMessages, newMessage]);

    if (userAtBottom) {
      setTimeout(() => {
        scrollToBottom();
      }, 0);
    }
  };

  const handleEditChange = (id, newMessage, e) => {
    messageRef.current.textContent = e.current.textContent;
    setMessages((prevMessages) => {
      const editedMessage = prevMessages.find((msg) => msg.id === id);
      if (editedMessage && editedMessage.message !== newMessage) {
        editedMessage.message = newMessage;
        const updatedMessages = prevMessages.map((msg) =>
          msg.id === id ? editedMessage : msg
        );
        socket.emit("edit_message", editedMessage);
        return updatedMessages;
      }
      return prevMessages;
    });
  };

  const handleDelete = (id) => {
    const messageIndex = messages.findIndex((msg) => msg.id === id);
    const deletedMessage = messages[messageIndex];
    const nextMessage = messages[messageIndex + 1];

    const updatedMessages = messages.filter((msg) => msg.id !== id);
    setMessages(updatedMessages);

    if (
      deletedMessage.userId === currentUserId &&
      nextMessage &&
      nextMessage.userId === currentUserId
    ) {
      if (user) {
        const updatedNextMessage = {
          ...nextMessage,
          username: localStorage.getItem("username"),
          pfp: user.pfp,
        };

        const nextMessageIndex = updatedMessages.findIndex(
          (msg) => msg.id === nextMessage.id
        );
        updatedMessages[nextMessageIndex] = updatedNextMessage;
        setMessages(updatedMessages);

        socket.emit("edit_message", updatedNextMessage);
      }
    }

    socket.emit("delete_message", id);
  };

  useEffect(() => {
    const textBoxElement = document.getElementById("messageBox");
    if (textBoxElement) {
      textBoxElement.addEventListener("keydown", handleInput);
    }
    return () => {
      if (textBoxElement) {
        textBoxElement.removeEventListener("keydown", handleInput);
      }
    };
  }, [handleInput]);

  const toggleModal = () => {
    setShowModal(!showModal);
  };

  let lastDateShownUserId = null;
  let userId;

  const isFirstVisit = localStorage.getItem("isFirstVisit");
  if (!isFirstVisit) {
    currentUserId == uuidv4();
    newToast(
      "Welcome!",
      "This is your first time here. Click on your own message to edit and click the trash icon to delete. Remember to set a username and profile picture! Enjoy chatting!",
      "info",
      7500
    );
    localStorage.setItem("isFirstVisit", "false");
  }

  return (
    <>
      <button className="settingsBtn" onClick={toggleModal}>
        Settings
      </button>
      <div
        className="settingsModal"
        style={{ display: showModal ? "block" : "none" }}
      >
        <span className="close" onClick={toggleModal}>
          <i className="fa-solid fa-square-xmark"></i>
        </span>
        <h1 style={{ textAlign: "center" }}>Settings</h1>
        <div className="usernameContainer">
          <h2 className="usernameH2">Set or Change Your Username</h2>
          <input
            className="usernameInput"
            type="text"
            placeholder="Type in your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
          <button
            className="saveUsernameBtn"
            onClick={(e) => {
              if (
                username.length >= 4 &&
                username.length <= 18 &&
                !/\s/.test(username)
              ) {
                if (currentUserId === null) {
                  userId = uuidv4();
                } else {
                  userId = currentUserId;
                }
                socket.emit("set_username", username, userId);
                localStorage.setItem("username", username);
                newToast("Done!", "Username set to " + username, "info");
                setUsername(e.target.value);
              } else {
                newToast(
                  "Error!",
                  "Username must be between 4 and 18 characters and cannot contain spaces",
                  "error"
                );
              }
            }}
          >
            Save
          </button>
        </div>
        <div className="profilePicContainer">
          <h2 className="profilePicH2">Set or Change Your Profile Picture</h2>
          <button onClick={handleClick}>Change or set Profile Picture</button>
          <button
            onClick={() => {
              changePfp();
              setFileSelected(false);
            }}
          >
            Upload
          </button>
          {showFileInput && (
            <div>
              <input
                type="file"
                id="file"
                accept="image/*"
                onChange={handleFileInput}
                className="fileInput"
                style={{ display: "none" }}
              />
              <label htmlFor="file" className="fileInputLabel">
                {fileSelected ? "File Selected" : "Choose a file"}
              </label>
              <button
                onClick={() => {
                  setShowFileInput(false);
                  setFileSelected(false);
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="rooms">
        <div className="home" onClick={() => handleJoinHome("home", "home")}>
          <i id="icon" className="fa-solid fa-house"></i>
        </div>
        <div
          className="globalRoom"
          onClick={() => handleJoinRoom("global", "global")}
        >
          <i id="icon" className="fa-solid fa-globe"></i>
        </div>
        {rooms
          .filter((room) => room.members.includes(currentUserId))
          .map((room) => {
            return (
              room && (
                <div key={room.id}>
                  <div
                    className="room"
                    onClick={() => handleJoinRoom(room.id, room.name)}
                  >
                    <i id="icon" className="fa-solid fa-comment"></i>
                    <div className="roomName">{room.name}</div>
                  </div>
                  {currentRoom !== "global" && currentRoom !== "home" && (
                    <button onClick={handleInviteClick} className="inviteBtn">
                      Invite
                    </button>
                  )}
                </div>
              )
            );
          })}
        {showInviteModal && (
          <div className="inviteModal">
            <span
              id="closeInviteModal"
              className="close"
              onClick={removeInviteModal}
            >
              <i className="fa-solid fa-square-xmark"></i>
            </span>
            <h1 style={{ textAlign: "center" }}>
              Invite somebody to your Room!
            </h1>
            <form onSubmit={handleInviteSubmit}>
              <input
                type="text"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                placeholder="Enter username to invite"
                className="inviteInput"
              />
              <button type="submit" className="invite">
                Invite
              </button>
            </form>
          </div>
        )}
        <div className="addRoom" onClick={() => handleAddRoomSettings()}>
          <i id="icon" className="fa-solid fa-plus"></i>
        </div>
        <div className="addRoomContainer" style={{ display: "none" }}>
          <span id="closeRoomModal" className="close" onClick={removeRoomModal}>
            <i className="fa-solid fa-square-xmark"></i>
          </span>
          <input
            className="addRoomInput"
            type="text"
            placeholder="Type a room name"
            style={{ display: "none" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const roomName = e.target.value;
                if (roomName.trim() !== "") {
                  handleAddRoom(roomName);
                  e.target.value = "";
                  removeRoomModal();
                } else {
                  newToast(
                    "Error!",
                    "Room name cannot be empty or only spaces",
                    "error"
                  );
                }
              }
            }}
          />
        </div>
      </div>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="directMessages">
                <i
                  id="addFriendIcon"
                  className="fa-solid fa-plus"
                  onClick={handleAddFriendClick}
                ></i>
                {showAddFriendModal && (
                  <div className="addFriendModal">
                    <span
                      id="closeAddFriendModal"
                      className="close"
                      onClick={removeAddFriendModal}
                    >
                      <i className="fa-solid fa-square-xmark"></i>
                    </span>
                    <h1>Add a friend!</h1>
                    <input
                      className="addFriendInput"
                      placeholder="Type in the username of the friend you want to invite"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddFriend(e.target.value);
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                )}
                <p className="addFriendText">Add Friend</p>
                <h5 className="dmHeader">DIRECT MESSAGES</h5>
                {friends.map((friendId) => {
                  const friendData = usersData.find(
                    (user) => user.userId === friendId
                  );

                  return (
                    <div className="friend" key={friendId}>
                      <img
                        src={friendData.pfp}
                        alt="friend's profile"
                        className="friendPfp"
                      />
                      <p>{friendData.username}</p>
                    </div>
                  );
                })}
                {friendRequests.map(
                  (request) =>
                    currentUserId === request.recipientId && (
                      <div key={request.id} className="friendRequest">
                        <p>{request.username} has sent you a friend request.</p>
                        <button
                          onClick={() =>
                            handleFriendRequestResponse(
                              request.id,
                              true,
                              request.recipientId
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            handleFriendRequestResponse(
                              request.id,
                              false,
                              request.recipientId
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )
                )}
              </div>
            </>
          }
        ></Route>
        <Route
          path="/rooms/:roomId"
          element={
            <div className="chat">
              <div className="roomTitle">
                <h2>{currentRoomName}</h2>
              </div>
              <div className="messages" ref={messagesEndRef}>
                {messages
                  .filter((msg) => msg !== null)
                  .map((msg, index) => {
                    const showDate =
                      index === 0 ||
                      (msg && msg.userId !== lastDateShownUserId);

                    if (showDate) {
                      lastDateShownUserId = msg.userId;
                    }

                    return (
                      <div
                        key={msg.id}
                        style={{ textAlign: "left" }}
                        className="message"
                      >
                        <span className="messageText">
                          {msg.pfp && (
                            <img
                              className="pfp"
                              src={msg.pfp}
                              alt="Profile picture"
                            />
                          )}
                          {msg.username && (
                            <strong className="strong">{msg.username}</strong>
                          )}
                          {showDate && (
                            <span className="messageDate">
                              {formatDate(msg.date)}
                            </span>
                          )}
                          <br />
                          <span style={{ marginLeft: "50px" }}>
                            <p
                              className={`messageTextText ${
                                !msg.message.includes(" ") ? "breakAll" : ""
                              }`}
                              ref={messageRef}
                              contentEditable={msg.userId === currentUserId}
                              spellCheck="false"
                              autoComplete="off"
                              id={`message-${msg.id}`}
                              onInput={(e) => {
                                handleEditChange(msg.id, e.target.textContent);
                              }}
                              suppressContentEditableWarning={true}
                            >
                              {msg.message.split("\n").map((line, index) => (
                                <span key={index}>
                                  {line}
                                  <br />
                                </span>
                              ))}
                            </p>
                          </span>
                        </span>
                        {msg.userId === currentUserId && (
                          <button
                            className="deleteBtn"
                            onClick={() => handleDelete(msg.id)}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              {isTyping && typingUser && (
                <div className="typingIndicator">
                  <p>{typingUser} is typing...</p>
                </div>
              )}
              <textarea
                id="messageBox"
                className="textBox"
                type="text"
                placeholder="Send a message"
                value={message}
                onChange={handleChange}
                onKeyDown={handleChange}
                autoComplete="off"
              />
            </div>
          }
        ></Route>
      </Routes>
    </>
  );
}

export default App;
