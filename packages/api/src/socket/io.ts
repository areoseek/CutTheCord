import type { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@ctc/shared';

type TypedIO = SocketServer<ClientToServerEvents, ServerToClientEvents>;

let io: TypedIO | null = null;

export function setIO(instance: TypedIO) {
  io = instance;
}

export function getIO(): TypedIO {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
