// --- Domain types ---

export type TimingLabel = "fasting" | "random" | "post-prandial";

// --- WhatsApp message shapes (subset of Graph API payload) ---

export type WATextMessage = {
  id: string;
  from: string;
  type: "text";
  text: { body: string };
};

export type WAInteractiveMessage = {
  id: string;
  from: string;
  type: "interactive";
  interactive: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
};

export type WAImageMessage = {
  id: string;
  from: string;
  type: "image";
  image: { id: string; mime_type: string; sha256: string };
};

export type WADocumentMessage = {
  id: string;
  from: string;
  type: "document";
  document: {
    id: string;
    filename: string;
    mime_type: string;
    sha256: string;
    file_size?: number; // bytes — present in most Meta payloads
  };
};

export type WAMessage =
  | WATextMessage
  | WAInteractiveMessage
  | WAImageMessage
  | WADocumentMessage;
