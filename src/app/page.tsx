'use client';
import { LuFile, LuMic, LuSend, LuFilePlus, LuTrash, LuBot } from "react-icons/lu";
import { useState, useEffect, useRef, useCallback } from "react";
import Chat from "./components/chat";
import ReactPdfViewer from "./components/react-pdfviewer";
import "react-pdf/dist/esm/Page/TextLayer.css";
import toast, { Toaster } from 'react-hot-toast';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

import crypto from "crypto";
// import { TextItem } from "pdfjs-dist/types/src/display/api";

class SourceDocument {
  pageContent: String;

  constructor(pageContent: String) {
    this.pageContent = pageContent;
  }
}

class ChatMessage {
  text: String;
  isMe: boolean;
  sourceDocuments: Array<SourceDocument> = [];

  constructor(text: String, isMe: boolean, sourceDocuments: Array<SourceDocument> = []) {
    this.text = text;
    this.isMe = isMe;
    this.sourceDocuments = sourceDocuments;
  }
}

function getLastSpan(element: Element) {
  if (element.tagName !== 'span') {
    return element;
  }
  element.querySelectorAll('span').forEach((span) => {
    return getLastSpan(span);
  })
}

export default function Home() {
  let userId: any = null;
  if (typeof window !== "undefined") {
    userId = localStorage.getItem("userId") || null
  }
  if (!userId) {
    userId = crypto.randomBytes(10).toString('hex');
    if (typeof window !== "undefined") {
      localStorage.setItem("userId", userId)
    }

  }
  const [isTyping, setIsTyping] = useState(false);

  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [textMessage, settextMessage] = useState<String | any>(null);
  const [chatHistory, setChatHistory] = useState<Array<ChatMessage>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [fileList, setFileList] = useState<Array<any>>([])
  const [selectedFile, setSelectedFile] = useState("-1");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [stringToHighlight, setStringToHighlight] = useState<string[] | any>(null);




  const selectSource = (chatIndex: number, sourceIndex: number) => {
    const source = chatHistory[chatIndex].sourceDocuments[sourceIndex];

    let cleanContent = source.pageContent.replace(/<[^>]*>?/gm, '');
    //remove double /n
    cleanContent = cleanContent.replace(/(\r\n|\n|\r)/gm, "");
    //clean double space
    cleanContent = cleanContent.trim().replace(/ +(?= )/g, '');
    // console.log(1,cleanContent);
    const rArr = cleanContent.split("\n").map((value) => value.trim()).filter((value) => value.length > 0);
    // console.log(rArr);
    //setStringToHighlight(rArr);
    if (window) {
      const reactPdfPage = document.querySelectorAll('div.react-pdf__Page');
      //loop reactPdfPage
      reactPdfPage.forEach((page, index) => {

        //clean text from html tag
        const cleanText = page.innerHTML.replace(/<[^>]*>?/gm, '');
        const spans = page.querySelectorAll('span[role="presentation"]');

        //jika sumber ada di dalam halaman
        if (cleanText.includes(cleanContent)) {
          // console.log(index);
          page.scrollIntoView({ behavior: "smooth", inline: "nearest" });
          spans.forEach((span) => {
            //replace inner html with mark
            const lastSpan = getLastSpan(span);
            
            if (lastSpan != undefined && lastSpan?.innerHTML != "") {
              lastSpan.innerHTML = "<mark>" + span.innerHTML + "</mark>";
            }
          })
        } else {
          spans.forEach((span) => {
            //remove mark inside span
            const lastSpan = getLastSpan(span);
            if (lastSpan != undefined && lastSpan?.innerHTML != "") {
              lastSpan.innerHTML = span.innerHTML.replace(/<mark>/gm, '').replace(/<\/mark>/gm, '');
            }
            //span.innerHTML = span.innerHTML.replace(/<mark>/gm, '').replace(/<\/mark>/gm, '');
          })
        }

      })
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory]);

  const handleFileSelect = (event: any) => {
    if (event.target.files != undefined && event.target.files.length > 0) {
      const file = event.target.files[0];
      const sizeByte = file.size;
      if (sizeByte > 5000000) {
        alert("File size must be less than 5MB");
        document.querySelectorAll('input[type=file]').forEach((input) => {
          (input as HTMLInputElement).value = ''
        })
        return;
      }
      (document.getElementById('my_modal_1') as HTMLDialogElement || null)?.close();
      uploadFile(file);
    }
  };

  function selectFileByUrl(url:string) {
    return fileList.find((file) => file.url === url);
  }

  const selectFile = async (url: string) => {
    setSelectedFile(url);
    const file = selectFileByUrl(url);
    (document.getElementById('my_modal_1') as HTMLDialogElement || null)?.close();
    setLoading(true);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set('app_id', userId as string);
    requestHeaders.set('key', file.name);
    requestHeaders.set('e_tag', file.e_tag);
    const res = await fetch('/api/get-file', {
      headers: requestHeaders
    })
    const data = await res.blob()
    if (data) {
      setPdf(await data.arrayBuffer())
    }
    getChatHistory(`${url}`);
    setLoading(false);

  };

  const deleteFile = async (url: string) => {
    const requestHeaders: HeadersInit = new Headers();
    const file = selectFileByUrl(url);
    requestHeaders.set('app_id', userId as string);
    requestHeaders.set('key', file.name);
    requestHeaders.set('e_tag', file.url);
    const res = await fetch('/api/delete-file', {
      method: 'DELETE',
      headers: requestHeaders
    })
    if (res.ok) {
      const data = await res.json()
      if (data) {
        window.localStorage.removeItem(userId as string + '_chatHistory_' + `${url}`);
        setFileList([...fileList.filter((item, i) => item.url !== url)])
        if (url == selectedFile) {
          setPdf(null)
          setSelectedFile("-1")
          setChatHistory([])

        }
        toast.success('Delete success')
      }
    } else {
      const data = await res.json()
      if (data && data.message) {
        toast.error('Delete failed : ' + data.message)
      } else {
        toast.error('Delete failed : ' + res.statusText)
      }

    }
  }

  const uploadFile = async (file: any) => {
    setLoading(true)
    const formData = new FormData();
    formData.append('file', file);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.append('app_id', userId as string);
    try {
      const res = await fetch('/api/upload-file', {
        method: 'POST',
        body: formData,
        headers: requestHeaders
      })
      if (res.ok) {
        const data = await res.json()

        setFileList([...fileList, {
          name: file.name,
          size: file.size,
          url:data.data.url,
          time: data.data.LastModified
        }])

        getListFile()
        setSelectedFile(data.data.url)
        getChatHistory(`${data.data.url}`);
        let reader = new FileReader();

        reader.onload = function (e) {
          if (reader.result != null) {
            const buffer = reader.result as ArrayBuffer;
            setPdf(buffer);

          }
        }

        reader.readAsArrayBuffer(file);

      } else {
        document.querySelectorAll('input[type=file]').forEach((input) => {
          (input as HTMLInputElement).value = ''
        })
        const data = await res.json()
        if (data && data.message) {
          toast.error('Upload failed : ' + data.message)
        } else {
          toast.error('Upload failed : ' + res.statusText)
        }
      }
    } catch (error) {
      document.querySelectorAll('input[type=file]').forEach((input) => {
        (input as HTMLInputElement).value = ''
      })
      toast.error('Upload failed : ' + error)
    }

    setLoading(false)
  };


  const handleInputChange = (e: { target: { value: string | any[]; }; }) => {
    settextMessage(e.target.value as String);
    if (e.target.value.length > 0) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
  };

  const enterInput = (e: any) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  }
  // useEffect(() => {
  //   window.localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  //  }, [chatHistory])
  const retriveMessage = async (previosChats: Array<ChatMessage>, currentChats: Array<ChatMessage>) => {
    setLoadingChat(true)
    const file = selectFileByUrl(selectedFile);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.append('app_id', userId as string);
    requestHeaders.append('key', file.name);
    let _chat_history: any[] = [];
    previosChats.forEach((chat) => {
      _chat_history.push({
        text: chat.text,
        isMe: chat.isMe
      });
    })
    const formData: BodyInit = JSON.stringify({ question: textMessage, chat_history: _chat_history });

    const res = await fetch('/api/chat', {
      method: 'POST',
      body: formData,
      headers: requestHeaders
    })
    if (res.ok) {
      const data = await res.json()
      let sourceDocuments: SourceDocument[] = [];
      if (data.sourceDocuments) {
        data.sourceDocuments.forEach((sourceDocument: any) => {
          sourceDocuments.push({
            pageContent: sourceDocument.pageContent,
          })
        });
      }
      const responseChat = new ChatMessage(data.response, false, sourceDocuments);
      currentChats.push(responseChat);
      saveChatHistory(selectedFile, currentChats)
      setChatHistory([...currentChats]);
    } else {
      const data = await res.json()
      if (data && data.message) {
        toast.error('Chat failed : ' + data.message)
      } else {
        toast.error('Chat failed : ' + res.statusText)
      }
    }
    setLoadingChat(false)


  }

  const sendMessage = () => {
    if (textMessage.length === 0) {
      return;
    }
    if (selectedFile == "-1") {
      alert("Please select a file to chat")
      return;
    }

    if (pdf == null && selectedFile != "-1") {
      alert("Please wait for the file to be loaded")
      return;
    }
    const newChat = new ChatMessage(textMessage, true);
    const previousChats = [...chatHistory]
    const currentChats = [...chatHistory];
    currentChats.push(newChat);
    saveChatHistory(selectedFile, currentChats)
    setChatHistory([...currentChats]);
    settextMessage("");
    retriveMessage(previousChats, currentChats);


  }




  const getListFile = async () => {
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set('app_id', userId as string);
    const res = await fetch('/api/list-file', {
      headers: requestHeaders
    })
    const data = await res.json()
    setFileList(data.files)
  }

  const getFile = async (e: any) => {
    setLoading(true)
    setSelectedFile(e.target.value)
    const file = selectFileByUrl(e.target.value);
    const requestHeaders: HeadersInit = new Headers();
    requestHeaders.set('app_id', userId as string);
    requestHeaders.set('key', file.name);
    requestHeaders.set('e_tag', file.e_tag);
    try {
      const res = await fetch('/api/get-file', {
        headers: requestHeaders
      })
      if (res.ok) {
        const data = await res.blob()
        if (data) {
          setPdf(await data.arrayBuffer())
        }
        getChatHistory(`${e.target.value}`);
        toast.success('Get file success')
      } else {
        toast.error('Get file failed : ' + res.statusText)

      }
    } catch (error: any) {
      toast.error('Get file failed : ' + error.message)
    }
    setLoading(false)

  }

  function saveChatHistory(urlFile: string, _chatHistory: Array<ChatMessage>) {
    window.localStorage.setItem(userId as string + '_chatHistory_' + urlFile, JSON.stringify(_chatHistory));
  }

  function getChatHistory(urlFile: string) {

    if (window) {
      const sessionChatHistory = window.localStorage.getItem(userId as string + '_chatHistory_' + urlFile);
      if (sessionChatHistory) {
        const _chat_history = JSON.parse(sessionChatHistory);
        let _chat_history_array: ChatMessage[] = [];
        _chat_history.forEach((chat: any) => {
          if (chat.text) {
            _chat_history_array.push(new ChatMessage(chat.text, chat.isMe, chat.sourceDocuments ?? []));
          }

        })
        setChatHistory([..._chat_history_array]);
      } else {
        saveChatHistory(`${urlFile}`, [])
        setChatHistory([...[]]);
      }
    }
  }


  useEffect(() => {
    getListFile()

  }, [])

  return (
    <main >

      <div className="flex flex-col h-screen">
        <dialog id="my_modal_1" className="modal">
          <form method="dialog" className="modal-box w-11/12 max-w-5xl">
            <div className="overflow-x-auto">
              <div className="flex justify-between">
                <div>
                  <h2 >Dokumenku</h2>
                  <small className="text-secondary">*hanya support file pdf dan hanya pdf yang bisa di search (hasil scan dokumen atau gambar kemungkinan akan gagal untuk di ekstrak teksnya)</small>
                </div>
                <div>
                  <label className="flex flex-col items-center px-2 py-1 rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer">
                    <span className="text-sm flex"><LuFilePlus className="mr-1 text-xl md:text-lg" /> Upload</span>
                    <input type='file'
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden" />
                  </label>
                </div>
              </div>

              <table className="table">
                {/* head */}
                <thead>
                  <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Size</th>
                    <th>*</th>
                  </tr>
                </thead>
                <tbody>
                  {fileList.map((file, index) =>
                    <tr className="hover" key={index} onClick={(e) => {
                      selectFile(file.url)
                    }}>
                      <th>{index + 1}</th>
                      <td>{file.name}</td>
                      <td>{
                        file.size > 1000000 ? (file.size / 1000000).toFixed(2) + ' MB' : (file.size / 1000).toFixed(2) + ' KB'
                      }</td>
                      <td>
                        <button className="btn btn-xs" type="button" onClick={(e) => {
                          const confirm = window.confirm('Apakah anda yakin ingin menghapus berkas ini? semua riwayat percakapan akan terhapus');
                          if (confirm) {
                            deleteFile(file.url);
                            (document.getElementById('my_modal_1') as HTMLDialogElement || null)?.close();
                          }

                          e.stopPropagation();
                          e.preventDefault();
                        }}><LuTrash /></button>
                      </td>
                    </tr>
                  )}


                </tbody>
              </table>
            </div>
            <div className="modal-action">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </div>
          </form>
        </dialog>

        {loading ? <div className="w-full h-full fixed block top-0 left-0 bg-black opacity-75 z-50">
          <span className="loading loading-infinity w-56 text-primary opacity-75 top-1/3 my-0 mx-auto block relative"></span>
        </div> : null}
        <div className="flex p-4 bg-base-300">
          <div className="justify-center content-center py-2 px-2 mx-2">
            <h3>Brokumen</h3>
          </div>
          <div className=" mx-2 w-80 hidden md:block">

            <select className="select w-full max-w-xs" value={selectedFile} onChange={getFile}>
              <option disabled value={-1}>Pilih Dokumen</option>
              {fileList.map((file, index) =>
                <option key={index} value={file.url} >{file.name}</option>
              )}
            </select>
          </div>
          <div>
            <div className="flex w-full items-center justify-center bg-grey-lighter">
              <button className="btn btn-outline btn-primary w-64" type="button" onClick={() => {
                (document.getElementById('my_modal_1') as HTMLDialogElement || null)?.showModal()
              }}><LuFile className="text-xl" /> Dokumenku</button>
              {/* <label className="w-64 flex flex-col items-center px-4 py-3 rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer">
                <span className="text-sm flex"></span>
                <input type='file' 
                onChange={handleFileSelect}
                 className="hidden" />
              </label> */}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-warp">
          <div className="w-1/2 py-4 px-4 overflow-y-auto left-panel hidden  md:flex" >
            {
              pdf ? <div className="w-full flex-1">
                <ReactPdfViewer fileBuffer={pdf} stringToHighlight={stringToHighlight} />
              </div> : <div className="flex-1 flex border border-dashed border-gray-500 relative">
                <input type="file" onChange={handleFileSelect} accept=".pdf" className="flex-1 cursor-pointer relative block opacity-0 w-full p-20 z-50" />
                <div className="text-center p-10 absolute top-0 right-0 left-0 bottom-0 block h-40 m-auto">
                  <h4>
                    Drop files anywhere to upload
                    <br />or
                  </h4>
                  <p className="">Select Files</p>
                </div>
              </div>
            }
          </div>
          <div className="flex polka md:w-1/2 w-full right-panel">
            <div className="w-full py-4 px-4 overflow-y-auto bg-base-200 flex-1 pb-32">
              {/* chat history */}
              {/* <Chat key={0} text={"Aku AI"} /> */}

              {chatHistory.map((chat, index: number) =>
                <div className="w-full" key={index}>
                  <Chat text={chat.text} isMe={chat.isMe} />
                  {chat.sourceDocuments?.map((doc, doc_index) =>
                    <div className="badge cursor-pointer" key={"sumber-" + index + "-" + doc_index} onClick={(e) => {
                      selectSource(index, doc_index);
                    }}>Sumber {doc_index + 1}</div>
                  )}
                </div>
              )
              }
              {loadingChat ?
                <div className="chat chat-start" key={0}>
                  <div className="chat-image avatar">
                    <div >
                      <LuBot className="rounded-full" size={'2rem'} />
                    </div>
                  </div>
                  <div className="chat-header">
                    AI
                  </div>
                  <div className="chat-bubble" >
                    <span className="loading loading-bars loading-md"></span>
                  </div>
                </div> : null}
              <div ref={messagesEndRef}></div>
            </div>

            <div className="flex w-full md:w-1/2 z-30 fixed bottom-0 p-5 bg-base-300">
              <div className="input-group">
                <input
                  type="text"
                  className="input input-primary w-full"
                  placeholder="Type your message..."
                  value={textMessage ?? ''}
                  onKeyDown={enterInput}
                  onChange={handleInputChange}
                />
                {/* {isTyping ? (
                  <button className="btn btn-square" onClick={sendMessage}>
                    <LuSend className="w-5 h-5 text-base-500" />
                  </button>
                ) : (
                  <button className="btn btn-square">
                    <LuMic className="w-5 h-5 text-base-500" />
                  </button>
                )} */}
                <button className="btn btn-square" onClick={sendMessage}>
                    <LuSend className="w-5 h-5 text-base-500" />
                  </button>
              </div>
            </div>
          </div>
        </div>
        <Toaster
          position="bottom-left"
          reverseOrder={false}
        />
        {/* <div className="toast toast-start alert-message">
          <div className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Error! Task failed successfully.</span>
          </div>
        </div> */}
      </div>

    </main >
  );
}
