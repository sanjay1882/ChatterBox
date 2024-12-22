/*import elements*/
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span ");
const chatbox = document.querySelector(".chatbox ");
const chatbtn = document.querySelector(".bx-send");

let sidebar = document.querySelector(".sidebar");
let closeBtn = document.querySelector("#btn");
let closeBtn1 = document.querySelector("#btn1");
let searchBtn = document.querySelector(".bx-search");



let userMessage;
/*slidebar-toogle */
closeBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  document.getElementById("btn1").style.display = "block";
  menuBtnChange();
});
searchBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");

  menuBtnChange();
});

closeBtn1.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  document.getElementById("btn1").style.display = "none";
  menuBtnChange();
});

/*Home_Suggestion-containers*/
const hometagContent = document.getElementById("home-tag-contentID");



const suggContent = document.getElementById("sugg");


suggContent.addEventListener("click", () => {
  const contentValue = suggContent.textContent;
  chatInput.innerHTML = contentValue;
  chatInput.value = chatInput.value.trim(); 
});

const suggContent2 = document.getElementById("sugg2");

suggContent2.addEventListener("click", () => {
  const contentValue = suggContent2.textContent;
  chatInput.innerHTML = contentValue;
  chatInput.value = chatInput.value.trim(); 
});
const suggContent3 = document.getElementById("sugg3");


suggContent3.addEventListener("click", () => {
  const contentValue = suggContent3.textContent;
  chatInput.innerHTML = contentValue;
  chatInput.value = chatInput.value.trim(); 
});
const suggContent4 = document.getElementById("sugg4");


suggContent4.addEventListener("click", () => {
  const contentValue = suggContent4.textContent;
  chatInput.innerHTML = contentValue;
  chatInput.value = chatInput.value.trim(); 
})

/* Onload Container*/
window.onload = function() {
  
  document.getElementById('preloader').style.display = 'none';

  document.body.style.visibility = 'visible';
  document.body.style.overflow = 'auto'; 
};

/*Creating a List Tag */
const createList = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const messageID = Math.random() * 100;
  let chatContent = className === "outgoing" ? `<p>${message}</p>` :
    `
   <span class="material-symbols-outlined">
   
   <img src="star-r.png" class="chatbot-img">
   </span>
 <p id="${messageID}">${message}</p>
   `;

  chatLi.innerHTML = chatContent;

  return chatLi;



}


/*Darkmode */
document.getElementById('darkmodebtn').addEventListener('click', function () {
  document.body.classList.toggle('white-mode');


});

/*Genarative-Ai Integration */
import { GoogleGenerativeAI } from "@google/generative-ai";


const API_KEY = "";


const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
async function generateResponse(incomingChatli) {

  const messageElement = incomingChatli.querySelector('p')
  const result = await model.generateContent(userMessage);
  const response = await result.response;
  const text = response.text();
  let responseArray = text.split("**");

  console.log(text)
  let newResponse;
  for (let i = 0; i < responseArray.length; i++) {
    if (i === 0 || i % 2 !== 1) {
      newResponse += responseArray[i]

    }

    else {
      newResponse += '<b class="Bold-head">' + responseArray[i] + '</b>';
    }
  }

  
  let New_output = newResponse
  // Replace markdown-style triple backticks for code blocks with <pre><code> tags
  .replace(/```(\w+)(.*?)```/gs, (match, language, codeContent) => {
    // Sanitize codeContent to remove formatting tags
    const sanitizedCodeContent = codeContent
      .replace(/<[^>]+>/g, '') // Remove all HTML tags
      .replace(/\*\*(.*?)\*\*/g, '$1'); // Remove markdown bold syntax (**bold**)

    if (language === 'html') {
      return `<div class="html-div">${sanitizedCodeContent}</div>`;
    } else {
      return `<div class="code-container"><div class="progem-lan">${language}</div><pre><code>${sanitizedCodeContent}</code></pre></div>`;
    }
  })
  // Replace '*' with two line breaks for more space between sections
  .split('*').join('<br/><br/>')
  // Add line breaks between ". <b>" and "<b>"
  .split(". <b>").join(". <br/><b>")
  // Remove '##'
  .split("##").join("")
  // Remove 'undefined'
  .split("undefined").join("")
  // Convert markdown table to responsive HTML table
  .replace(
    /\|(.+)\|\s*\n\|([-\s|]+)\|\s*\n((\|.+\|(\s*\n)?)+)/g,
    (match, header, separator, body) => {
      const headers = header
        .split('|')
        .map(h => `<th>${h.trim()}</th>`)
        .join('');
      const rows = body
        .trim()
        .split('\n')
        .map(row =>
          `<tr>${row
            .split('|')
            .map(cell => cell.trim()) // Trim spaces
            .filter(cell => cell)     // Remove empty cells
            .map(cell => `<td>${cell}</td>`)
            .join('')}</tr>`
        )
        .join('');

      return `<div style="overflow-x:auto;"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
  );

// Set the innerHTML of the message element
messageElement.innerHTML = New_output;




}


/*Handle Chat */
const ChatHandle = () => {

  hometagContent.style.display = "none";
  userMessage = chatInput.value.trim();
  if (!userMessage) return;
  createList(userMessage, "outgoing");
  chatbox.appendChild(createList(userMessage, "outgoing"));
  userMessage = chatInput.value.trim();

  chatbox.scrollTo(0, chatbox.scrollHeight);

  setTimeout(() => {
     

    const incomingChatli = createList('', "incoming")
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
      console.log(transcript);
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



chatInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") { 
    event.preventDefault(); 
    ChatHandle(); 
  }
});

sendChatBtn.addEventListener("click", ChatHandle);



function speakAnimationStart() {
  const speakStart = document.getElementById("start-btn");
  const speakStop = document.getElementById("stop-btn");

  speakStart.style.display = "none";
  speakStop.style.display = "block";
}


function speakAnimationStop() {
  const speakStart = document.getElementById("start-btn");
  const speakStop = document.getElementById("stop-btn");

  speakStart.style.display = "block";
  speakStop.style.display = "none";
}





document.addEventListener('DOMContentLoaded', function() {
  const darkmodeBtn = document.getElementById('darkmodebtn');

  darkmodeBtn.addEventListener('click', function() {
      if (darkmodeBtn.classList.contains('bxs-sun')) {
          darkmodeBtn.classList.remove('bxs-sun');
          darkmodeBtn.classList.add('bxs-moon');
      } else {
          darkmodeBtn.classList.remove('bxs-moon');
          darkmodeBtn.classList.add('bxs-sun');
      }
  })
})

