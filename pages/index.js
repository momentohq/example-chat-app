import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { FaPlus } from "react-icons/fa";
import Link from "next/link";
import { faker } from "@faker-js/faker";
import {
  TopicClient,
  CacheClient,
  CredentialProvider,
  Configurations,
  CacheSetFetch,
  CollectionTtl,
} from "@gomomento/sdk-web";

export default function Home() {
  const [topicClient, setTopicClient] = useState(null);
  const [cacheClient, setCacheClient] = useState(null);
  const [chatRooms, setChatRooms] = useState([]);
  const [credentials, setCredentials] = useState(null);

  const login = useCallback(async () => {
    const username =
      `${faker.color.human()}-${faker.animal.type()}`.toLowerCase();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_AUTH_BASE_URL}/authenticate`,
      {
        method: "POST",
        body: JSON.stringify({
          username,
        }),
      }
    );

    const token = await response.json();
    const userInfoResponse = await fetch(
      `${process.env.NEXT_PUBLIC_AUTH_BASE_URL}/userinfo`
    );

    const userInfo = await userInfoResponse.json();
    const credentials = {
      auth: token,
      user: { ...userInfo, username },
    };

    sessionStorage.setItem("credentials", JSON.stringify(credentials));
    setCredentials(credentials);
  }, []);

  useEffect(() => {
    const storedCredentials = sessionStorage.getItem("credentials");
    if (storedCredentials) {
      const creds = JSON.parse(storedCredentials);
      if (
        !creds.user?.claims?.momento?.exp ||
        creds.user?.claims?.momento?.exp < Date.now()
      ) {
        sessionStorage.removeItem("credentials");
        login();
      } else {
        setCredentials(creds);
      }
    } else {
      login();
    }
  }, [login]);

  const getRoomList = useCallback(async () => {
    const roomListResponse = await cacheClient?.setFetch(
      "chat",
      "chat-room-list"
    );
    if (roomListResponse instanceof CacheSetFetch.Hit) {
      setChatRooms(roomListResponse.valueArrayString().sort());
    } else {
      setChatRooms([]);
    }
  }, [cacheClient]);

  const initializeCacheClient = useCallback(() => {
    if (!cacheClient) {
      const client = new CacheClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString({
          authToken: credentials.user.claims.momento.token,
        }),
        defaultTtlSeconds: 3600,
      });

      setCacheClient(client);
    }
  }, [cacheClient, credentials]);

  const initializeTopicClient = useCallback(() => {
    if (!topicClient) {
      const client = new TopicClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString({
          authToken: credentials.user.claims.momento.token,
        }),
      });

      setTopicClient(client);
    }
  }, [topicClient, credentials, getRoomList]);

  useEffect(() => {
    if (topicClient) {
      topicClient.subscribe("chat", "chat-room-created", {
        onItem: async () => await getRoomList(),
        onError: (err) => console.log(err),
      });
    }
  }, [topicClient, getRoomList]);

  useEffect(() => {
    if (credentials && !topicClient) {
      initializeTopicClient();
      initializeCacheClient();
    }

    if (cacheClient && topicClient) {
      getRoomList();
    }
  }, [
    credentials,
    cacheClient,
    topicClient,
    initializeCacheClient,
    initializeTopicClient,
    getRoomList,
  ]);

  const handleCreateChatRoom = useCallback(async () => {
    const chatRoomName = faker.science.chemicalElement().name;
    initializeCacheClient();
    await cacheClient?.setAddElement("chat", "chat-room-list", chatRoomName, {
      ttl: new CollectionTtl(3600),
    });
    await topicClient?.publish(
      "chat",
      "chat-room-created",
      JSON.stringify({ name: chatRoomName })
    );
  }, [cacheClient, topicClient, initializeCacheClient]);

  return (
    <div>
      <Head>
        <title>Chat Rooms | Momento</title>
      </Head>
      <div className="toolbar">
        <h1>Momento Instant Messenger⚡</h1>
        <button className="create-button" onClick={handleCreateChatRoom}>
          <FaPlus />
        </button>
      </div>
      <div className="chat-rooms-container">
        {chatRooms.map((room) => (
          <Link key={room} href={`/chat/${room}`}>
            <a className="chat-room-link">{room}</a>
          </Link>
        ))}
      </div>
    </div>
  );
}
