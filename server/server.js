import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "data", "users.json");
const apiRouter = express.Router();

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use("/api", apiRouter);

const userSockets = new Map();

apiRouter.get("/messages", (res) => {
  const messages = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "messages.json"), "utf8")
  );
  res.json({ messages });
});

apiRouter.get("/users", (res) => {
  const users = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "messages.json"), "utf8")
  );
  res.json({ users });
});

apiRouter.post("/rooms", (req, res) => {
  const newRoom = req.body;
  const roomsFilePath = path.join(__dirname, "data", "rooms.json");

  let rooms = [];
  if (fs.existsSync(roomsFilePath)) {
    const fileContent = fs.readFileSync(roomsFilePath, "utf-8");
    if (fileContent) {
      rooms = JSON.parse(fileContent);
    }
  }

  rooms.push(newRoom);
  fs.writeFileSync(roomsFilePath, JSON.stringify(rooms));

  res.json({ success: true });
});

apiRouter.get("/rooms", (req, res) => {
  const roomsFilePath = path.join(__dirname, "data", "rooms.json");

  let rooms = [];
  if (fs.existsSync(roomsFilePath)) {
    const fileContent = fs.readFileSync(roomsFilePath, "utf-8");
    if (fileContent) {
      rooms = JSON.parse(fileContent);
    }
  }

  res.json({ rooms });
});

apiRouter.get("/invite/:roomId/:username", (req, res) => {
  const { roomId, username } = req.params;
  const users = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
  const invitedUser = users.find((user) => user.username === username);
  if (!invitedUser) {
    res.json({ success: false, message: "User not found" });
    return;
  }
  const invitedUserId = invitedUser.userId;

  const roomsFilePath = path.join(__dirname, "data", "rooms.json");
  let rooms = JSON.parse(fs.readFileSync(roomsFilePath, "utf8"));
  const room = rooms.find((room) => room.id === roomId);
  if (!room) {
    res.json({ success: false, message: "Room not found" });
    return;
  }

  if (room.members.includes(invitedUserId)) {
    res.json({ success: false, message: "User is already in the room" });
    return;
  }

  if (!room.users) {
    room.users = [];
  }
  room.users.push(invitedUser);
  room.members.push(invitedUserId);

  fs.writeFileSync(roomsFilePath, JSON.stringify(rooms));

  const invitedUserSocket = userSockets.get(invitedUserId);
  if (invitedUserSocket) {
    io.emit("room_invitation", { room, userId: invitedUserId });
    res.json({
      success: true,
    });
    return;
  }

  res.json({
    success: false,
    message: "User is not connected",
  });
});

const upload = multer({ storage: multer.memoryStorage() });

apiRouter.post("/users/uploads", upload.single("image"), (req, res) => {
  const targetPath = path.join(
    __dirname,
    "./data/uploads/",
    req.body.userId + path.extname(req.file.originalname)
  );

  const dir = path.join(__dirname, "./data/uploads/");

  fs.readdirSync(dir).forEach((file) => {
    if (file.startsWith(req.body.userId)) {
      fs.unlinkSync(path.join(dir, file));
    }
  });

  fs.writeFile(targetPath, req.file.buffer, (err) => {
    if (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Failed to upload image" });
      return;
    }

    const imageUrl = `http://localhost:8080/api/users/uploads/${
      req.body.userId + path.extname(req.file.originalname)
    }`;
    const usersData = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    const user = usersData.find((user) => user.userId === req.body.userId);
    const users = JSON.parse(fs.readFileSync("./data/users.json", "utf8"));
    const userId = req.body.userId;
    const pfpPath = `/api/users/uploads/${path.extname(req.file.originalname)}`;
    const userIdStr = String(userId);
    users[userIdStr] = { pfp: pfpPath };
    fs.writeFileSync("./data/users.json", JSON.stringify(users));

    if (user) {
      user.pfp = imageUrl;
      fs.writeFileSync(usersFilePath, JSON.stringify(usersData));
    }

    res.json({ success: true, pfp: pfpPath, imageUrl });
  });
});

apiRouter.get("/users/:username", (req, res) => {
  const { username } = req.params;
  const usersData = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
  const user = usersData.find((user) => user.username === username);
  if (user) {
    res.json({ friends: user.friends });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});

app.use(express.static(path.join(__dirname, "../chat-app/dist")));
apiRouter.use(
  "/users/uploads",
  express.static(path.join(__dirname, "./data/uploads"))
);

const users = new Map();

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.join("global_chat");

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  const messagesFilePath = path.join(__dirname, "data", "messages.json");
  if (!fs.existsSync(messagesFilePath)) {
    fs.writeFileSync(messagesFilePath, JSON.stringify([]));
  }

  let messages = [];
  if (fs.existsSync(messagesFilePath)) {
    const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
    if (fileContent) {
      messages = JSON.parse(fileContent);
    }
  }
  socket.emit("existing_messages", messages);

  socket.on("message", (messageObject, roomId) => {
    socket.broadcast.to(roomId).emit("message", messageObject);
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }

    messageObject.roomId = roomId;
    messages.push(messageObject);
    fs.writeFileSync(messagesFilePath, JSON.stringify(messages));
  });

  socket.on("get_room_messages", (roomId) => {
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    let roomMessages = messages.filter((message) => message.roomId === roomId);
    socket.emit("room_messages", roomMessages);
  });

  socket.on("set_username", (username, userId) => {
    users.set(socket.id, { username, userId });
    userSockets.set(userId, socket);

    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(
        path.join(__dirname, "data", "users.json"),
        JSON.stringify([])
      );
    }

    let usersData = [];
    const fileContent = fs.readFileSync(
      path.join(__dirname, "data", "users.json"),
      "utf8"
    );
    if (fileContent) {
      usersData = JSON.parse(fileContent);
    }

    const userIndex = usersData.findIndex((user) => user.userId === userId);
    if (userIndex !== -1) {
      usersData[userIndex].username = username;
      usersData[userIndex].id = socket.id;
    } else {
      usersData.push({ id: socket.id, username, userId });
    }

    fs.writeFileSync(
      path.join(__dirname, "data", "users.json"),
      JSON.stringify(usersData)
    );
  });

  let friendRequests = [];

  socket.on("friend_request", ({ senderId, senderUsername, recipientId }) => {
    friendRequests.push({ senderId, senderUsername, recipientId });
    io.emit("friend_request", { senderId, senderUsername, recipientId });
  });

  socket.on(
    "friend_request_response",
    ({ accepted, senderId, recipientId }) => {
      if (accepted) {
        friendRequests = friendRequests.filter(
          (request) => request.senderId !== senderId
        );

        let usersData = [];
        const fileContent = fs.readFileSync(
          path.join(__dirname, "data", "users.json"),
          "utf8"
        );
        if (fileContent) {
          usersData = JSON.parse(fileContent);
        }

        const senderIndex = usersData.findIndex(
          (user) => user.userId === senderId
        );
        const recipientIndex = usersData.findIndex(
          (user) => user.userId === recipientId
        );

        if (senderIndex !== -1) {
          if (!usersData[senderIndex].friends) {
            usersData[senderIndex].friends = [];
          }
          usersData[senderIndex].friends.push(recipientId);
        }

        if (recipientIndex !== -1) {
          if (!usersData[recipientIndex].friends) {
            usersData[recipientIndex].friends = [];
          }
          usersData[recipientIndex].friends.push(senderId);
        }

        fs.writeFileSync(
          path.join(__dirname, "data", "users.json"),
          JSON.stringify(usersData)
        );
      } else {
        io.to(recipientId).emit("friend_request_response", { accepted: false });
      }
    }
  );

  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("start_typing", (username) => {
    socket.broadcast.emit("typing", username);
  });

  socket.on("stop_typing", () => {
    socket.broadcast.emit("typing", null);
  });

  socket.on("edit_message", (editedMessage) => {
    socket.broadcast.emit("edit_message", editedMessage);

    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(messagesFilePath, "utf-8");
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }

    const messageIndex = messages.findIndex(
      (message) => message.id === editedMessage.id
    );

    if (messageIndex !== -1) {
      messages[messageIndex] = editedMessage;
    }

    fs.writeFileSync(
      path.join(__dirname, "data", "messages.json"),
      JSON.stringify(messages)
    );
  });

  socket.on("delete_message", (messageId) => {
    let messages = [];
    if (fs.existsSync(messagesFilePath)) {
      const fileContent = fs.readFileSync(
        path.join(__dirname, "data", "messages.json"),
        "utf8"
      );
      if (fileContent) {
        messages = JSON.parse(fileContent);
      }
    }
    messages = messages.filter((message) => message.id !== messageId);
    fs.writeFileSync(
      path.join(__dirname, "data", "messages.json"),
      JSON.stringify(messages)
    );
    io.emit("delete_message", messageId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
    const user = users.get(socket.id);
    if (user) {
      io.emit("user_disconnected", user.username);
      users.delete(socket.id);
    }
  });
});

httpServer.listen(8080, () => console.log("Listening on port 8080"));
