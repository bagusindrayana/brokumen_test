import { LuUser, LuBot } from "react-icons/lu";
import React, { useState } from "react";


export default function Chat({ text, isMe }: { text: String, isMe?: boolean }) {

    
    return (
        <div className={isMe ? "chat chat-end" : "chat chat-start"}>
            <div className="chat-image avatar">
                <div >
                    {
                        isMe ?
                            <LuUser className="rounded-full" size={'2rem'} />
                            : <LuBot className="rounded-full" size={'2rem'} />
                    }
                </div>
            </div>
            <div className="chat-header">
                {isMe ? "User" : "AI"}

            </div>
            <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: text }} />
            {/* <div className="chat-footer opacity-50">
                Seen at 12:46
            </div> */}
        </div>
    );
}