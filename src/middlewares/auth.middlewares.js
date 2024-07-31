import { ApiError,ApiResponse,asyncHandler } from "../utils/Index.js";
import {User} from "../models/Index.js";
import jwt from "jsonwebtoken";

const isAuthenticated = asyncHandler(async (req,res,next)=>{
    const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");
    if(!accessToken)
            throw new ApiError(401,"UNAUTHORIZED REQUEST");
    const decodedToken = jwt.verify(accessToken,process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    req.user = user;
    next();
});

export const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) throw new ApiError(400,err.message);
    const authToken = socket.request.cookies.accessToken;
    if (!authToken)
      return new ApiResponse(401,"Please login to access this route");
    const decodedData = jwt.verify(authToken, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedData._id);
    if (!user)
      return new ApiResponse(401,"Please login to access this route");
    socket.user = user;
    return next();
  } catch (error) {
    const errorMessage = error;
    // console.log(errorMessage);
  }
};

export default isAuthenticated;