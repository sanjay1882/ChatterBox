


const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span ");
const chatbox = document.querySelector(".chatbox ");
const chatbtn = document.querySelector(".bx-send");
let userMessage;
let sidebar = document.querySelector(".sidebar");
  let closeBtn = document.querySelector("#btn");
  let closeBtn1 = document.querySelector("#btn1");
  let searchBtn = document.querySelector(".bx-search");
  closeBtn.addEventListener("click", ()=>{
    sidebar.classList.toggle("open");
    document.getElementById("btn1").style.display="block";
    menuBtnChange();
  });
  searchBtn.addEventListener("click", ()=>{
    sidebar.classList.toggle("open");
      
    menuBtnChange(); 
  });
 
  closeBtn1.addEventListener("click", ()=>{
    sidebar.classList.toggle("open");
    document.getElementById("btn1").style.display="none";
    menuBtnChange();
  });


  
  const hometagContent = document.getElementById("home-tag-contentID");
  


const suggContent=document.getElementById("sugg");


suggContent.addEventListener("click",()=>{
  const contentValue=suggContent.textContent;
  chatInput.innerHTML=contentValue;
});

const suggContent2=document.getElementById("sugg2");

suggContent2.addEventListener("click",()=>{
  const contentValue=suggContent2.textContent;
  chatInput.innerHTML=contentValue;
});
const suggContent3=document.getElementById("sugg3");


suggContent3.addEventListener("click",()=>{
  const contentValue=suggContent3.textContent;
  chatInput.innerHTML=contentValue;
});
const suggContent4=document.getElementById("sugg4");


suggContent4.addEventListener("click",()=>{
  const contentValue=suggContent4.textContent;
  chatInput.innerHTML=contentValue;
})



const createChatli = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const messageID =Math.random()*100;
  let chatContent = className === "outgoing" ? `<p>${message}</p>` :
   `
   <span class="material-symbols-outlined">
   
   <img src="assests/Designer.png" class="chatbot-img">
   </span>
 <p id="${messageID}">${message}</p>
   <i class="bx bx-copy" id="${messageID}" title="Copy" onclick="copyText(${messageID})"></i>
   <i class="bx bx-dots-vertical-rounded"></i>`;
  
  chatLi.innerHTML = chatContent;
  return chatLi;
  


}



document.getElementById('darkmodebtn').addEventListener('click', function() {
  document.body.classList.toggle('dark-mode');


});


import { GoogleGenerativeAI } from "@google/generative-ai";


const API_KEY = "";


const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
async function generateResponse(incomingChatli){
            
       const messageElement=incomingChatli.querySelector('p')
        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const text = response.text();
        let  responseArray =text.split("**");
       
        console.log(text)
        let newResponse;
        for(let i=0; i< responseArray.length;i++){
          if(i===0 || i%2 !==1){
            newResponse+=responseArray[i]
          
          }
          
          else{
            newResponse+='<b>'+responseArray[i]+'</b>';
          }
        }
   
        let newResponse6 = newResponse
        .split('*').join('<br/><br/>')
        .split(". <b>").join(". <br/><b>")
        .split("##").join("")
        .split("undefined").join("")
        // Set innerHTML directly
        messageElement.innerHTML = newResponse6;
        
  }



const handlechat = () => {

hometagContent.style.display="none";
  userMessage = chatInput.value.trim();
if (!userMessage)return;
  createChatli(userMessage, "outgoing");
  chatbox.appendChild(createChatli(userMessage, "outgoing"));
  userMessage = chatInput.value.trim();

  chatbox.scrollTo(0, chatbox.scrollHeight);

setTimeout(() => {
  const incomingChatli=createChatli("Thinking...", "incoming")
  chatbox.appendChild(incomingChatli);
  generateResponse(incomingChatli);
}, 600);
  




}



if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const startSound = document.getElementById('startSound');
  const stopSound = document.getElementById('stopSound');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      document.getElementById('inputa').value = transcript;
  }

 
  recognition.onstart = function() {
      console.log('Speech recognition started');
      startSound.play(); 
      speakAnimationStart();
  }


  recognition.onend = function() {
      console.log('Speech recognition ended');
      stopSound.play();
      speakAnimationStop();
  }

  recognition.onerror = function(event) {
      console.error('Speech recognition error occurred:', event.error);
  }

  
  document.getElementById('start-btn').addEventListener('click', function() {
   
      navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function(stream) {
              console.log('Microphone permission granted');
              recognition.start();
          })
          .catch(function(err) {
              console.error('Microphone permission denied:', err);
          });
  });


  document.getElementById('stop-btn').addEventListener('click', function() {
      recognition.stop();
  });

} else {
  console.error('Speech recognition not supported in this browser.');
}


function handleKeyPress(event) {
  if (event.keyCode === 13) {
    
    var chatInput = document.getElementById("inputa").value.trim();
    if (chatInput !== "") {
      handlechat();
    }
  }
  if (event.keyCode === "Enter") {
    
    var chatInput = document.getElementById("inputa").value.trim();
    if (chatInput !== "") {
      handlechat();
    }
  }
  if (event.keyCode === "enter") {
    
    var chatInput = document.getElementById("inputa").value.trim();
    if (chatInput !== "") {
      handlechat();
    }
  }
}

sendChatBtn.addEventListener("click", handlechat);



function speakAnimationStart(){
 const speakStart=document.getElementById("start-btn");
 const speakStop=document.getElementById("stop-btn");

  speakStart.style.display="none";
  speakStop.style.display="block";
}


function speakAnimationStop(){
  const speakStart=document.getElementById("start-btn");
  const speakStop=document.getElementById("stop-btn");
 
   speakStart.style.display="block";
   speakStop.style.display="none";
 }
 












