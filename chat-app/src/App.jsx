import "./App.css";
import { useState } from "react";

function App() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [username, setUsername] = useState("");

    const handleChange = (e) => {
        if (e.key === "Enter") {
            sendMessage(message);
            setMessage("");
        } else {
            setMessage(e.target.value);
        }
    };

    const sendMessage = (message) => {
        const username = localStorage.getItem("username");
        if (!username || username === "") {
            alert("Please set a username before sending a message.");
            return;
        }
        setMessages((prevMessages) => [...prevMessages, message]);
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
                                alert("Username set to " + username);
                                setUsername("");
                            } else {
                                alert("Username must be between 4 and 18 characters");
                            }
                        }
                    }}
                />
            </div>
            {messages.map((msg, index) => (
                <p key={index} style={{ textAlign: "left" }}>
                    <strong className="strong">{ localStorage.getItem("username") }</strong> {msg}
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
