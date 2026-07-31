/** Request augmentations set by our own middleware. */
declare global {
  namespace Express {
    interface Request {
      /** Set by `correlationId()`; always present downstream of that middleware. */
      correlationId: string;
    }
  }
}

export {};
