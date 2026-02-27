export type RequestWithUser = {
  user?: {
    sub: string;
    email: string;
  };
};
