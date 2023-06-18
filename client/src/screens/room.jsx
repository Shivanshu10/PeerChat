import React, { useCallback, useEffect, useState } from "react";
import ReactPlayer from "react-player";
import { useSocket } from "../context/SocketProvider";
import peer from "../service/peer";

const RoomPage = () => {
    const socket = useSocket()
    const [remoteSocketId, setRemoteSocketId] = useState(null)
    const [myStream, setMyStream] = useState(null)
    const [remoteStream, setRemoteStream] = useState(null)

    const handleCallUser = useCallback(async () => {
        // webcam strean 
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        // screen share
        // const stream = await navigator.mediaDevices.getDisplayMedia(
        //     {
        //         video: {
        //             displaySurface: "window",
        //         },
        //         audio: false,
        //     }
        // );
        const offer = await peer.getOffer()
        socket.emit("user:call", { to: remoteSocketId, offer })
        setMyStream(stream)
    }, [remoteSocketId, socket])

    const handleUserJoined = useCallback(({email, id}) => {
        console.log(`Email ${email} joined room`)
        setRemoteSocketId(id) 
    }, [])

    const handleIncomingCall = useCallback(async ({from, offer}) => {
        setRemoteSocketId(from)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        setMyStream(stream)
        console.log(`Incoming Call`, from, offer)
        const ans = await peer.getAnswer(offer)
        socket.emit("call:accepted", {to: from, ans})
    }, [socket])

    const sendStreams = useCallback(() => {
        for (const track of myStream.getTracks()) {
            console.log("Adding tracks!!")
            peer.peer.addTrack(track, myStream)
        }
    }, [myStream])

    const handleCallAccepted = useCallback(({from, ans}) => {
        peer.setLocalDescription(ans)
        console.log("Call Accepted")
        sendStreams()
    }, [sendStreams])

    const handleNegoNeeded = useCallback(async () => {
        const offer = await peer.getOffer()
        socket.emit("peer:nego:needed", {to: remoteSocketId, offer})
    }, [socket, remoteSocketId])

    const handleNegoNeededIncoming = useCallback(async ({from, offer}) => {
        console.log(offer)
        const ans = await peer.getAnswer(offer)
        console.log("Ans Created")
        socket.emit("peer:nego:done", {to: from, ans})
    }, [socket])

    const handleNegoFinal = useCallback(async ({ans}) => {
        await peer.setLocalDescription(ans)
    }, [])

    useEffect(() => {
        peer.peer.addEventListener('negotiationneeded', handleNegoNeeded)
        return () => {
            peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded)
        }
    }, [handleNegoNeeded])

    useEffect(() => {
        peer.peer.addEventListener("track", async (ev) => {
            console.log("GOT TRACKS!!!")
            const remote_stream = ev.streams
            console.log("Rcvd Tracks")
            console.log(remote_stream[0])
            setRemoteStream(remote_stream[0])
            console.log()
        })
    }, [])

    useEffect(() => {
        socket.on("user:joined", handleUserJoined)
        socket.on("incoming:call", handleIncomingCall)
        socket.on("call:accepted", handleCallAccepted)
        socket.on("peer:nego:needed", handleNegoNeededIncoming)
        socket.on("peer:nego:final", handleNegoFinal)

        return () => {
            socket.off("user:joined", handleUserJoined)
            socket.off("incoming:call", handleIncomingCall)
            socket.off("call:accepted", handleCallAccepted)
            socket.off("peer:nego:needed", handleNegoNeededIncoming)
            socket.off("peer:nego:final", handleNegoFinal)
        }
    }, [socket, handleUserJoined, handleIncomingCall, handleCallAccepted, handleNegoNeededIncoming, handleNegoFinal])

    return (
        <div>
            <h1>Room</h1>
            <h4>{remoteSocketId ? "Connected" : "No one in room"}</h4>
            {myStream && <button onClick={sendStreams}>Send Stream</button>}
            {
                remoteSocketId && <button onClick={handleCallUser}>Call</button>
            }
            {
                myStream && <><h1>Your Video:</h1> <ReactPlayer playing muted height="100px" width="200px" url={myStream} /></>
            }
            {
                remoteStream && <><h1>Remote Video:</h1> <ReactPlayer playing muted height="100px" width="200px" url={remoteStream} /></>
            }
        </div>
    )
}

export default RoomPage