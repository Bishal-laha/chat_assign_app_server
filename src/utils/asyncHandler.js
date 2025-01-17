const asyncHandler = (passedFunction)=> async(req,res,next)=>{
    try {
        await passedFunction(req,res,next);
    } catch (error) {
        res.status(error.code || 500).json({
            success:false,
            message:error.message
        });
    }
}

export default asyncHandler;