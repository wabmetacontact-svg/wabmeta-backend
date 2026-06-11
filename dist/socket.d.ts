import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
export declare const initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const emitForceLogout: (userId: string, reason?: string) => void;
export declare const getIO: () => Server;
export declare const closeSocketIO: () => Promise<void>;
declare const _default: {
    initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    getIO: () => Server;
    closeSocketIO: () => Promise<void>;
    emitForceLogout: (userId: string, reason?: string) => void;
};
export default _default;
//# sourceMappingURL=socket.d.ts.map