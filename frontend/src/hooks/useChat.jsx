import { createContext, useContext, useEffect, useState } from "react";

const backendUrl = import.meta.env.VITE_BACKEND_URL || ""; // empty => same-origin Vercel functions

const ChatContext = createContext();

// Health check function to verify backend connectivity
const checkBackendHealth = async () => {
  try {
    const healthPath = backendUrl ? `${backendUrl}/` : `/api/health`;
    const response = await fetch(healthPath, {
      method: "GET",
      timeout: 5000,
    });
    return response.ok;
  } catch (error) {
    console.warn("Backend health check failed:", error);
    return false;
  }
};

export const ChatProvider = ({ children }) => {
  const chat = async (message) => {
    setLoading(true);
    
    // First check if backend is healthy
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
      const fallbackMessage = {
        text: `I can't connect to my brain right now. Please make sure the backend server is running at ${backendUrl}.`,
        facialExpression: "sad",
        animation: "Talking_0",
        audio: null,
        lipsync: null
      };
      setMessages((messages) => [...messages, fallbackMessage]);
      setLoading(false);
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const chatPath = backendUrl ? `${backendUrl}/chat` : `/api/chat`;
      const response = await fetch(chatPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const resp = data.messages;
      
      if (resp && Array.isArray(resp)) {
        setMessages((messages) => [...messages, ...resp]);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Chat error:", error);
      
      let errorMessage = "Something went wrong while I was thinking.";
      if (error.name === 'AbortError') {
        errorMessage = "I'm taking too long to respond. The server might be processing audio.";
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = "I lost connection to my brain. Please check if the backend server is still running.";
      }
      
      const fallbackMessage = {
        text: errorMessage,
        facialExpression: "sad",
        animation: "Talking_0",
        audio: null,
        lipsync: null
      };
      setMessages((messages) => [...messages, fallbackMessage]);
    } finally {
      setLoading(false);
    }
  };
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [cameraZoomed, setCameraZoomed] = useState(true);
  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        chat,
        message,
        onMessagePlayed,
        loading,
        cameraZoomed,
        setCameraZoomed,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};
