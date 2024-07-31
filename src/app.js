import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {userRouter,chatRouter} from "./routes/Index.js";
import { Server} from "socket.io";
import {createServer} from "http";
import { CHAT_EXIT, CHAT_JOIN, NEW_ALERT_MESSAGE, NEW_MESSAGE, ONLINE_USER, START_TYPING, STOP_TYPING } from "./constants/events.constants.js";
import {v4 as uuid} from "uuid";
import { getSocketID } from "./utils/features.js";
import Message from "./models/message.models.js";
import { socketAuthenticator } from "./middlewares/auth.middlewares.js";
import { ApiError } from "./utils/ApiError.js";

const app = express();
const server = createServer(app);
const io = new Server(server,{cors:{
    origin:process.env.CORS_ORIGIN,
    credentials:true
}});
app.set("io",io);
const userSocketIDs = new Map();
const onlineUsers = new Set();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}));

app.use(express.urlencoded());
app.use(express.json())
app.use(cookieParser());

app.use("/api/v1/user",userRouter);
app.use("/api/v1/chat",chatRouter);

io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticator(err, socket, next)
  );
});

io.on("connection",(socket)=>{
    const user = socket.user;
    userSocketIDs.set(user._id.toString(),socket.id);
    socket.on(NEW_MESSAGE, async({chatId,members,message})=>{
        const messageForRealTime = {
            _id: uuid(),
            content: message,
            sender:{_id:user._id,fullName:user.fullName},
            chat: chatId,
            createdAt: new Date().toISOString()
        };
        const messageForDb = {
            content: message,
            sender: user._id,
            chat: chatId
        };
        
        const memberSockets = getSocketID(members);
        io.to(memberSockets).emit(NEW_MESSAGE,{chatId,message:messageForRealTime});
        io.to(memberSockets).emit(NEW_ALERT_MESSAGE,{chatId});
        try {
            await Message.create(messageForDb);
        } catch (error) {
            throw new ApiError(400,error.message);
        }
    });

    socket.on(START_TYPING, ({members,chatId})=>{
        const membersSocket = getSocketID(members);
        io.to(membersSocket).emit(START_TYPING,{chatId});
    });

    socket.on(STOP_TYPING, ({members,chatId})=>{
        const membersSocket = getSocketID(members);
        io.to(membersSocket).emit(STOP_TYPING,{chatId});
    });

    socket.on(CHAT_JOIN,({userId,members})=>{
        onlineUsers.add(userId.toString());
        const membersSocket = getSocketID(members);
        io.to(membersSocket).emit(ONLINE_USER,Array.from(onlineUsers));
    });

    socket.on(CHAT_EXIT,({userId,members})=>{
        onlineUsers.delete(userId.toString());
        const membersSocket = getSocketID(members);
        io.to(membersSocket).emit(ONLINE_USER,Array.from(onlineUsers));
    });

    socket.on("disconnect",()=>{
        userSocketIDs.delete(user._id.toString());
        onlineUsers.delete(user._id.toString());
        socket.broadcast.emit(ONLINE_USER, Array.from(onlineUsers));
    });
})

export {app,server,userSocketIDs};