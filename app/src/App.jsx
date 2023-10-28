import "./App.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { newToast } from "./util/toast";
import io from "socket.io-client";

function App() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [username, setUsername] = useState("");
    const [socket, setSocket] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showFileInput, setShowFileInput] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef();

    const handleInput = useCallback(() => {
        if (!isTyping) {
            setIsTyping(true);
            socket.emit("typing", { username });
        }
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
            socket.emit("typing", { username });
        }, 3000);
    }, [isTyping, socket, username]);

    useEffect(() => {
        if (message !== "") {
            setIsTyping(true);
        }
    }, [message]);

    useEffect(() => {
        if (socket) {
            socket.on("typing", () => {
                setIsTyping(true);
                setTimeout(() => setIsTyping(false), 3000);
            });

            return () => {
                socket.off("typing");
            };
        }
    }, [socket, isTyping]);

    const handleFileInput = (e) => {
        setSelectedFile(e.target.files[0]);
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

        s.on("message", (messageObject) => {
            setMessages((prevMessages) => [...prevMessages, messageObject]);
        });

        s.on("start_typing", () => {
            setIsTyping(true);
        });

        s.on("stop_typing", () => {
            setIsTyping(false);
        });

        return () => {
            s.disconnect();
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
        const username = localStorage.getItem("username");
        const pfp = localStorage.getItem("pfp");
        const image = selectedFile ? URL.createObjectURL(selectedFile) : null;
        if (!username || username === "") {
            newToast("Error!", "Please set your username first", "error", 2500);
            return;
        }
        if (!pfp || pfp === null) {
            newToast(
                "Error!",
                "Please set your profile picture first",
                "error"
            );
            return;
        }
        socket.emit("message", { pfp, username, message, image });
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
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (
                                    username.length >= 4 &&
                                    username.length <= 18
                                ) {
                                    localStorage.setItem("username", username);
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
                    <button onClick={changePfp}>Upload</button>
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
                                Choose a file
                            </label>
                            <button onClick={() => setShowFileInput(false)}>
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {messages.map((msg, index) => (
                <p
                    key={index}
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
                        <strong className="strong">{msg.username}</strong>
                        <br />
                        <span style={{ marginLeft: "50px" }}>
                            {msg.message}
                        </span>
                    </span>
                </p>
            ))}
            {isTyping && (
                <div className="typingIndicator">
                    {isTyping && <p>Someone is typing...</p>}
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
            />
        </>
    );
}

export default App;
