import {User,Chat,Request} from "../models/Index.js";
import {ApiError,ApiResponse,asyncHandler} from "../utils/Index.js";
import {NEW_FRIEND_REQUEST, REFETCH, REQ_REJECT} from "../constants/events.constants.js";
import {emitEvent} from "../utils/features.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";


export const registerUser = asyncHandler(async (req,res)=>{
        const {fullName,username,password,avatarDefault,isFile} = req.body;
        const existedUser = await User.findOne({username});
        if(existedUser)
            throw new ApiError(400,"User Already Exists");
        let avatar;
        if(isFile === "true"){
            const file = req.file;
            const result = await uploadOnCloudinary([file]);
            avatar = {
                public_id: result[0].public_id,
                url: result[0].url,
            }
        }else{
            avatar = {
                public_id: Math.random()*1000,
                url: avatarDefault,
            }
        }
        const userRef = await User.create({fullName,username,password,avatar});
        return res.status(200).json(new ApiResponse(200,"User Created SuccessFully",userRef));
});


export const loginUser = asyncHandler(async(req,res)=>{
        const {username,password} = req.body;
        const user = await User.findOne({username}).select("+password");
        if(!user)
            throw new ApiError(400,"NO SUCH USER");
        const validatedPassword = await user.isPasswordValidate(password);
        if(!validatedPassword)
            throw new ApiError(400,"INVALID CREDENTIALS");
        const accessToken = await user.generateAccessToken();
        const option = {httpOnly:true,secure:true,sameSite:"none"};
        return res.status(200)
                  .cookie("accessToken",accessToken,option)
                  .json(new ApiResponse(200,"User Logged In Successfully",{user,accessToken}));
});


export const logoutUser = asyncHandler(async (req,res)=>{
        const option = {httpOnly:true,secure:true};
        return res.status(200)
                .clearCookie("accessToken",option)
                .json(new ApiResponse(200,"User Logged Out Successfully"));
});

export const getProfile = asyncHandler(async (req,res)=>{
    const user = await User.findById(req.user._id);
    return res.status(200).json(new ApiResponse(200,"User Data Successfully Sent",user));
});

export const searchUser = asyncHandler(async(req,res)=>{
    const {name=""} = req.query;
    const myChats = await Chat.find({members:req.user._id});
    const allFriends = myChats.flatMap((item)=>item.members);
    const allUnknownMembers = await User.find({
        _id:{$nin:allFriends},
        fullName:{$regex:name,$options:"i"}
    });
    const searchUser = allUnknownMembers.map(({_id,fullName,avatar})=>({
        _id,fullName,avatar:avatar.url
    }));
    return res.status(200).json(new ApiResponse(200,"Get The Search Result",searchUser));
});

export const sendFriendRequest = asyncHandler(async(req,res)=>{
    const {receiverId} = req.body;
    const request = await Request.findOne({
        $or:[
            {sender:req.user._id,receiver:receiverId},
            {sender:receiverId,receiver:req.user._id}
        ]
    });
    if(request)
        throw new ApiError(400,"Request Already Been Sent");
    await Request.create({
        sender:req.user._id,
        receiver:receiverId
    });
    emitEvent(req,NEW_FRIEND_REQUEST,[receiverId]);
    return res.status(200).json(new ApiResponse(200,"Friend Request Sent"));
});

export const acceptFriendRequest = asyncHandler(async(req,res)=>{
    const {requestId,accept} = req.body;
    const request = await Request.findById(requestId).populate("sender","fullName").populate("receiver","fullName");
    if(!request)
        throw new ApiError(400,"Request Not Found");
    if(request.receiver._id.toString() !== req.user._id.toString())
        throw new ApiError(400,"You are not authorized");
    const members = [request.sender._id, request.receiver._id];
    if(!accept){
        await request.deleteOne();
        emitEvent(req, REQ_REJECT, members, {receiverId: request.receiver._id});
        return res.status(200).json(new ApiResponse(200,"Friend Request Rejected"));
    }
    await Promise.all([
        Chat.create({members,name: `${request.sender.fullName}-${request.receiver.fullName}`}),
        request.deleteOne(),
    ]);
    emitEvent(req, REFETCH, members);
    return res.status(200).json(new ApiResponse(200,"Friend Request Accepted"));
});

export const getNotification = asyncHandler(async(req,res)=>{
    const request = await Request.find({receiver:req.user._id}).populate("sender","fullName avatar");
    const allRequests = request.map(({ _id, sender }) => (
        {_id,sender: {_id: sender._id,fullName: sender.fullName,avatar: sender.avatar.url}}));
    return res.status(200).json(new ApiResponse(200,"New Notifications",allRequests));
});

export const getFriends = asyncHandler(async(req,res)=>{
    const chatId = req.query.chatId;;
    const chats = await Chat.find({
        members:req.user._id,
    }).populate("members","fullName avatar");
    const friends = chats?.map(({members})=>{
        const otherUsers = members.find((item) => item._id.toString() !== req.user._id.toString());
        if(otherUsers){
            return{
                _id:otherUsers._id,
                fullName:otherUsers.fullName,
                avatar:otherUsers.avatar.url
            }
        }else   
            return {};
    });
    if (chatId) {
        const chat = await Chat.findById(chatId);
        const availableFriends = friends.filter(
        (friend) => !chat.members.includes(friend._id)
        );
        return res.status(200).json(new ApiResponse(200,"Get friends successfully",availableFriends));
    }else 
        return res.status(200).json(new ApiResponse(200,"get friends success",friends));
});