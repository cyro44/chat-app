import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { newToast } from "./util/toast";
import io from "socket.io-client";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const messageRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("global");
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState("");
  const [socket, setSocket] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFileInput, setShowFileInput] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const typingTimeoutRef = useRef();

  const currentUser = localStorage.getItem("username");
  const currentUserId = localStorage.getItem("userId");

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

      return () => {
        socket.off("typing");
        socket.off("user_disconnected");
        socket.off("room_messages");
      };
    }
  }, [socket, currentUser, typingUser]);

  const handleFileInput = (e) => {
    setSelectedFile(e.target.files[0]);
    setFileSelected(true);
  };

  const changePfp = () => {
    if (selectedFile) {
      let urlCreator = window.URL || window.webkitURL;
      let imageUrl = urlCreator.createObjectURL(selectedFile);
  
      localStorage.setItem("pfp", imageUrl);
      newToast("Done!", "Your new profile picture is set", "info");
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

  const handleJoinRoom = (roomId) => {
    if (currentRoom) {
      socket.emit("leave_room", currentRoom);
    }

    socket.emit("join_room", roomId);
    socket.emit("get_room_messages", roomId);
    setCurrentRoom(roomId);
  };

  const handleAddRoomSettings = () => {
    const newRoomInput = document.querySelector(".addRoomInput");
    newRoomInput.style.display = "block";
    newRoomContainer.style.display = "block";
  };

  const handleAddRoom = (roomName) => {
    const newRoom = {
      id: uuidv4(),
      name: roomName,
    };

    socket.emit("add_room", newRoom);
    setRooms((oldRooms) => [...oldRooms, newRoom]);
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
      const updatedNextMessage = {
        ...nextMessage,
        username: localStorage.getItem("username"),
        pfp: localStorage.getItem("pfp"),
      };

      const nextMessageIndex = updatedMessages.findIndex(
        (msg) => msg.id === nextMessage.id
      );
      updatedMessages[nextMessageIndex] = updatedNextMessage;
      setMessages(updatedMessages);

      socket.emit("edit_message", updatedNextMessage);
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
      <div className="rooms">
        <div className="globalRoom" onClick={() => handleJoinRoom("global")}>
          <i id="icon" className="fa-solid fa-globe"></i>
        </div>
        {rooms.map((room) => (
          <div
            className="room"
            key={room.id}
            onClick={() => handleJoinRoom(room.id)}
          >
            <i id="icon" className="fa-solid fa-comment"></i>
            <div className="roomName">{room.name}</div>
          </div>
        ))}
        <div className="addRoom" onClick={() => handleAddRoomSettings()}>
          <i id="icon" className="fa-solid fa-plus"></i>
        </div>
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
      <div className="chat">
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
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.target.value == currentUser) {
                  newToast(
                    "Error!",
                    "The username you chose is the same as your current username",
                    "error",
                    2500
                  );
                  return;
                }
                if (
                  username.length >= 4 &&
                  username.length <= 18 &&
                  !/\s/.test(username)
                ) {
                  if (localStorage.getItem("userId") === null) {
                    userId = uuidv4();
                  } else {
                    userId = localStorage.getItem("userId");
                  }
                  socket.emit("set_username", username, userId);
                  localStorage.setItem("username", username);
                  newToast("Done!", "Username set to " + username, "info");
                  setUsername("");
                } else {
                  newToast(
                    "Error!",
                    "Username must be between 4 and 18 characters and cannot contain spaces",
                    "error"
                  );
                }
              }}
            />
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
        <div className="messages" ref={messagesEndRef}>
          {messages
            .filter((msg) => msg !== null)
            .map((msg, index) => {
              const showDate =
                index === 0 || (msg && msg.userId !== lastDateShownUserId);

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
    </>
  );
}

export default App;
