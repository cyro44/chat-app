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
        setMessages((prevMessages) => [...prevMessages, message]);
    };

    // const modal = document.querySelector(".usernameModal");
    // const span = document.getElementsByClassName("close")[0];
    // span.onclick = function () {
    //     modal.style.display = "none";
    // };

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
                            localStorage.setItem("username", username);
                            setUsername("");
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
