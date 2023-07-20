import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { FaArrowLeft } from 'react-icons/fa';
import Head from 'next/head';
import styles from '../../styles/chat.module.css';
import { TopicClient, CacheClient, CredentialProvider, Configurations, CacheListFetch } from '@gomomento/sdk-web';

const Chat = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [credentials, setCredentials] = useState(null);
  const [topicClient, setTopicClient] = useState(null);
  const [cacheClient, setCacheClient] = useState(null);
  const chatWindowRef = useRef(null);
 
  useEffect(() => {
    console.log('test', messages);
  }, [messages])

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const storedCredentials = sessionStorage.getItem('credentials');
    if (storedCredentials) {
      const creds = JSON.parse(storedCredentials);
      // if (!creds.user?.claims?.momento?.exp || creds.user?.claims?.momento?.exp < Date.now()) {
      //   sessionStorage.removeItem('credentials');
      //   router.push('/');
      // } else {
      setCredentials(creds);
      //   }
      // } else {
      //   router.push('/');
    }
  }, []);

  const initializeCacheClient = useCallback(() => {
    if (!cacheClient) {
      const client = new CacheClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString({ authToken: credentials?.user?.claims.momento.token }),
        defaultTtlSeconds: 3600
      });

      setCacheClient(client);
    }
  }, [credentials, cacheClient]);

  const initializeTopicClient = useCallback(() => {
    if (!topicClient && router.query.room) {
      const client = new TopicClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString({ authToken: credentials?.user?.claims.momento.token })
      });

      setTopicClient(client);
    }
  }, [credentials, router, topicClient]);

  const loadChatHistory = useCallback(async () => {
    const chatHistoryResponse = await cacheClient?.listFetch('chat', router.query.room);
    if (chatHistoryResponse instanceof CacheListFetch.Hit) {
      const history = chatHistoryResponse.valueListString().map(msg => JSON.parse(msg));
      setMessages(history);
    }
  }, [cacheClient, router]);

  const setupMomento = useCallback(async () => {
    initializeTopicClient();
    initializeCacheClient();
    await loadChatHistory();
  }, [initializeCacheClient, initializeTopicClient, loadChatHistory]) 

  useEffect(() => {
    if (credentials && !topicClient) {
      setupMomento();
    }

    if (credentials?.user?.username) {
      setName(credentials?.user?.username);
    }
  }, [credentials]);

  const saveMessage = useCallback(async (newMessage) => {
    console.log(newMessage);
    const detail = JSON.parse(newMessage);
    setMessages((prev) => [detail, ...prev]);
  }, []);

  useEffect(() => {
    if (topicClient) {
      topicClient.subscribe('chat', `${router.query.room}-chat`, {
        onItem: async (data) => await saveMessage(data.value()),
        onError: (err) => console.log(err)
      });
    }
  }, [topicClient, router, saveMessage])

  const sendMessage = useCallback(async (event) => {
    event.preventDefault();
    const msg = JSON.stringify({ username: name, message });
    topicClient?.publish('chat', `${router.query.room}-chat`, msg);
    setMessage("");
    cacheClient?.listPushFront('chat', router.query.room, msg);
  }, [message, name, topicClient, cacheClient, router]);

  const handleOnChange = useCallback((event) => {
    setMessage(event.target.value);
  }, [])

  const handleOnKeyPress = useCallback((event) => {
    if (event.key === 'Enter') {
      sendMessage(event);
    };
  }, [sendMessage]);

  return (
    <div>
      <Head>
        <title>{router.query.room} Chat | Momento</title>
      </Head>
      <div className={styles['header']}>
        <div onClick={() => router.push('/')} className={styles['back-button']}>
          <FaArrowLeft size={30} color='white'/>
        </div>
        <h1 className={styles.h1}>{router.query.room} Chat</h1>
      </div>
      <div className={styles['chat-container']}>
        <ul className={styles.messages}>
          {messages.map((msg, index) => (
            <li key={index} className={msg.username === name ? styles['my-message'] : styles['message']}>
              <strong>{msg.username}: </strong>{msg.message}
            </li>
          ))}
        </ul>
        <div ref={chatWindowRef} />
        <div className={styles['user-info']}>You are logged in as {name}</div>
        <div className={styles['input-container']}>
          <input
            type="text"
            className={styles['text-input']}
            placeholder="Type your message here"
            value={message}
            onChange={handleOnChange}
            onKeyPress={handleOnKeyPress}
          />
          <button className={styles.btn} onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
