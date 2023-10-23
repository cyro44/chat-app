import "./App.css";
import { useState } from "react";

function App() {
    const [message, setMessage] = useState("");

    const handleChange = (e) => {
        if (e.key === "Enter") {
            sendMessage({ message });
            setMessage("");
        } else {
            setMessage(e.target.value);
        }
    };

    return (
        <input
            id="textBox"
            className="textBox"
            type="text"
            placeholder="Send a message"
            value={message}
            onChange={handleChange}
            onKeyDown={handleChange}
        />
    );
}

function sendMessage(message) {
    console.log(message);
}

export default App;
