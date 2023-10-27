import "./App.css";
import { useState, useEffect } from "react";
import { newToast } from "./util/toast";
import io from "socket.io-client";

function App() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [username, setUsername] = useState("");
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const s = io("http://localhost:5173");
        setSocket(s);

        s.on("message", (messageObject) => {
            console.log("Received message:", messageObject.message);
            setMessages((prevMessages) => [...prevMessages, messageObject]);
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
        if (!username || username === "") {
            newToast("Error!", "Please set your username first", "error", 2500);
            return;
        }
        console.log("Sending message:", message);
        socket.emit("message", { username, message });
    };

    const toggleModal = () => {
        setShowModal(!showModal);
    };

    return (
        <>
            <button className="usernameBtn" onClick={toggleModal}>
                Set or change your username
            </button>
            <div
                className="usernameModal"
                style={{ display: showModal ? "block" : "none" }}
            >
                <span className="close" onClick={toggleModal}>
                    <i className="fa-solid fa-square-xmark"></i>
                </span>
                <h1>Set or Change your Username</h1>
                <input
                    className="usernameInput"
                    type="text"
                    placeholder="Type in your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            if (username.length >= 4 && username.length <= 18) {
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
            {messages.map((msg, index) => (
                <p
                    key={index}
                    style={{ textAlign: "left" }}
                    className="message"
                >
                    <strong className="strong">{msg.username}</strong>{" "}
                    {msg.message}
                </p>
            ))}
            <input
                id="textBox"
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
