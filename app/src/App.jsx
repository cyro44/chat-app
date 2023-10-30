import { useCallback, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import "./App.css";
import { newToast } from "./util/toast";

function App() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [username, setUsername] = useState("");
    const [socket, setSocket] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showFileInput, setShowFileInput] = useState(false);
    const [fileSelected, setFileSelected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState("");
    const typingTimeoutRef = useRef();
    const [editingMessage, setEditingMessage] = useState(null);

    const currentUser = localStorage.getItem("username");

    const handleInput = useCallback(() => {
        const username = localStorage.getItem("username");
        if (!isTyping && username) {
            setIsTyping(true);
            socket.emit("start_typing", username);
        }
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
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
            socket.on("typing", (username) => {
                if (username && username !== currentUser) {
                    setIsTyping(true);
                    setTypingUser(username);
                    setTimeout(() => setIsTyping(false), 3000);
                } else {
                    setIsTyping(false);
                    setTypingUser("");
                }
            });

            return () => {
                socket.off("typing");
            };
        }
    }, [socket, currentUser]);

    const handleFileInput = (e) => {
        setSelectedFile(e.target.files[0]);
        setFileSelected(true);
    };

    const changePfp = () => {
        if (selectedFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                localStorage.setItem("pfp", reader.result);
                newToast("Done!", "Your new profile picture is set", "info");
            };
            reader.readAsDataURL(selectedFile);
        } else {
            newToast("Error!", "No file selected", "error");
        }
    };

    const handleClick = () => {
        setShowFileInput(true);
    };

    useEffect(() => {
        const s = io("http://127.0.0.1:5173");
        setSocket(s);

        if (s) {
            s.on("message", (messageObject) => {
                setMessages((prevMessages) => [...prevMessages, messageObject]);
            });

            s.on("start_typing", () => {
                setIsTyping(true);
            });

            s.on("stop_typing", () => {
                setIsTyping(false);
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
    }, []);

    const handleChange = (e) => {
        if (e.key === "Enter") {
            if (message.trim() === "") {
                newToast(
                    "Error!",
                    "Message cannot be empty or only spaces",
                    "error"
                );
            } else {
                sendMessage(message);
                setMessage("");
            }
        } else {
            setMessage(e.target.value);
        }
    };

    const sendMessage = (message) => {
        const previousMessageUserId = messages[messages.length - 1]?.userId;
        const currentUserId = localStorage.getItem("userId");
        let username = localStorage.getItem("username");
        let pfp = localStorage.getItem("pfp");

        if (!username || username === "" || !pfp || pfp === "") {
            if (!username || username === "") {
                newToast(
                    "Error!",
                    "Please set your username first",
                    "error",
                    2500
                );
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

        const image = selectedFile ? URL.createObjectURL(selectedFile) : null;
        const newMessage = {
            id: uuidv4(),
            userId: currentUserId,
            pfp,
            username,
            message,
            image,
        };
        socket.emit("message", newMessage);
    };

    const handleEdit = (id) => {
        if (editingMessage === id) {
            setEditingMessage(null);
        } else {
            setEditingMessage(id);
        }
    };

    const handleEditChange = (e, id) => {
        setMessages(
            messages.map((msg) =>
                msg.id === id ? { ...msg, message: e.target.value } : msg
            )
        );
        const updatedMessages = messages.map((msg) =>
            msg.id === id ? { ...msg, message: e.target.value } : msg
        );
        setMessages(updatedMessages);

        const editedMessage = updatedMessages.find((msg) => msg.id === id);
        if (editedMessage) {
            socket.emit("edit_message", editedMessage);
        }
    };

    const handleDelete = (id) => {
        const messageIndex = messages.findIndex((msg) => msg.id === id);
        const deletedMessage = messages[messageIndex];
        const nextMessage = messages[messageIndex + 1];
    
        const updatedMessages = messages.filter((msg) => msg.id !== id);
        setMessages(updatedMessages);

        if (deletedMessage.userId === currentUserId && nextMessage && nextMessage.userId === currentUserId) {
            const updatedNextMessage = {
                ...nextMessage,
                username: localStorage.getItem("username"),
                pfp: localStorage.getItem("pfp"),
            };

            const nextMessageIndex = updatedMessages.findIndex((msg) => msg.id === nextMessage.id);
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

    const currentUserId = localStorage.getItem("userId");
    let userId;

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
                <h1>Settings</h1>
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
                            if (e.key === "Enter") {
                                if (
                                    username.length >= 4 &&
                                    username.length <= 18
                                ) {
                                    localStorage.setItem("username", username);
                                    userId = uuidv4();
                                    localStorage.setItem("userId", userId);
                                    newToast(
                                        "Done!",
                                        "Username set to " + username,
                                        "info"
                                    );
                                    setUsername("");
                                } else {
                                    newToast(
                                        "Error!",
                                        "Username must be between 4 and 18 characters",
                                        "error"
                                    );
                                }
                            }
                        }}
                    />
                </div>
                <div className="profilePicContainer">
                    <h2 className="profilePicH2">
                        Set or Change Your Profile Picture
                    </h2>
                    <button onClick={handleClick}>
                        Change or set Profile Picture
                    </button>
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
                                {fileSelected
                                    ? "File Selected"
                                    : "Choose a file"}
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
            {messages.map((msg) => (
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
                        <br />
                        <span style={{ marginLeft: "50px" }}>
                            {editingMessage === msg.id ? (
                                <input
                                    className="editInput"
                                    value={msg.message}
                                    onChange={(e) =>
                                        handleEditChange(e, msg.id)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleEdit(msg.id);
                                        }
                                    }}
                                />
                            ) : (
                                msg.message
                            )}
                        </span>
                    </span>
                    {msg.userId === currentUserId && (
                        <button
                            className="editBtn"
                            onClick={() => handleEdit(msg.id)}
                        >
                            {editingMessage === msg.id ? (
                                "Save"
                            ) : (
                                <i className="fa-solid fa-pen-to-square"></i>
                            )}
                        </button>
                    )}
                    {msg.userId === currentUserId && (
                        <button
                            className="deleteBtn"
                            onClick={() => handleDelete(msg.id)}
                        >
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    )}
                </div>
            ))}
            {isTyping && typingUser && (
                <div className="typingIndicator">
                    <p>{typingUser} is typing...</p>
                </div>
            )}
            <input
                id="messageBox"
                className="textBox"
                type="text"
                placeholder="Send a message"
                value={message}
                onChange={handleChange}
                onKeyDown={handleChange}
                autoComplete="off"
            />
        </>
    );
}

export default App;