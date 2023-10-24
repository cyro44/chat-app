import "./App.css";
import { useState } from "react";

function App() {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);

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

    return (
        <>
            {messages.map((msg, index) => (
                <p key={index} style={{ textAlign: "left" }}>
                    {msg}
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
