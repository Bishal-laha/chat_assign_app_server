import {User,Message,Chat} from "../models/Index.js";
import { ApiError, ApiResponse,asyncHandler } from "../utils/Index.js";
import {emitEvent} from "../utils/features.js";
import {NEW_ALERT_MESSAGE,NEW_MESSAGE} from "../constants/events.constants.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

export const getMyChat = asyncHandler(async(req,res)=>{
    const chats = await Chat.find({members:req.user}).populate("members","fullName avatar");
    const transformedChats = chats.map(({_id,members})=>{
        const otherMember = members.find((item)=> item._id.toString() !== req.user._id.toString());
        if(otherMember){
            return {
                _id, avatar: otherMember?.avatar?.url,
                name:otherMember?.fullName,
                members: members.reduce((prev,curr)=>{
                    if(curr._id.toString() !== req.user._id.toString()){
                        prev.push(curr._id);
                    } 
                    return prev;
                },[])
            }
        }else
            return null;
    })
    return res.status(200).json(new ApiResponse(200,"Get user chats",transformedChats));
});

export const sendAttachment = asyncHandler(async(req,res)=>{
    const {chatId} = req.body;
    const files = req.files || [];
    if(files.length < 1)
        throw new ApiError(400,"You can select 1 file atLeast");
    if(files.length > 5)
        throw new ApiError(400,"You can select 5 files atMax");
    const [chat,user] = await Promise.all([Chat.findById(chatId),User.findById(req.user._id, "fullName")]);
    if(!chat)
        throw new ApiError(400,"No such chat exist");
    const attachments = await uploadOnCloudinary(files);
    const messageForRealTime = {content:"", attachments, chat:chatId, sender:{
        _id:user._id,
        name:user.fullName,
        avatar:user.avatar.url
    }};
    const messageForDb = {content:"", attachments, chat:chatId,sender:user._id}; 
    const message = await Message.create(messageForDb);
    emitEvent(req,NEW_MESSAGE,chat.members,{message:messageForRealTime,chatId});
    emitEvent(req,NEW_ALERT_MESSAGE,chat.members,{chatId});
    return res.status(200).json(new ApiResponse(200,message));
});

export const getChatDetails = asyncHandler(async(req,res)=>{
    const chatId = req.params.id;
    if(req.query.populate==="true"){
        const chat = await Chat.findById(chatId).populate("members","fullName avatar creator").lean();
        if(!chat)
            throw new ApiError(400,"No chat found");
        chat.members = chat.members.map((item)=>({...item,avatar:item.avatar?.url}));  
        return res.status(200).json(new ApiResponse(200,"Sent Populate Chat Details",chat));  
    }else{
        const chat = await Chat.findById(chatId);
        if(!chat)
            throw new ApiError(400,"No chat found");
        return res.status(200).json(new ApiResponse(200,"Sent Chat Details",chat));
    }
});

export const getMessages = asyncHandler(async(req,res)=>{
    const chatId = req.params.id;
    const {page=1} = req.query;
    const limit = 20;
    const skip = (page-1)*limit;
    const chat = await Chat.findById(chatId);
    if(!chat)
        throw new ApiError(404,"Chat not found");
    if(!chat.members.includes(req.user._id.toString()))
        throw new ApiError(400,"You are not allowed");
    const [messages,totalMessageCount] = await Promise.all([
        Message.find({chat:chatId})
               .sort({createdAt:-1})
               .skip(skip)
               .limit(limit)
               .populate("sender","fullName avatar")
               .lean(),
        Message.countDocuments({chat:chatId})
    ]);
    const totalPage = Math.ceil(totalMessageCount/limit);
    return res.status(200).json(new ApiResponse(200,"Get Message Successfully",{message:messages.reverse(),totalPage:totalPage}));
});