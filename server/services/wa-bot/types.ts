// --- Domain types ---

export type TimingLabel = "fasting" | "random" | "post-prandial";

// --- WhatsApp message shapes (subset of Graph API payload) ---

export type WATextMessage = {
  id: string;
  from: string;
  type: "text";
  text: { body: string };
};

export type WAInteractiveReply = {
  id: string;
  title: string;
};

export type WAInteractiveMessage = {
  id: string;
  from: string;
  type: "interactive";
  interactive: {
    /**
     * "flow" arrives when a user completes a WhatsApp Flow. Nothing consumes it
     * yet — Flows also need a separate webhook field and an approved template,
     * so widen this union rather than treating an unrecognised reply as a
     * button.
     */
    type: "button_reply" | "list_reply" | "flow";
    button_reply?: WAInteractiveReply;
    list_reply?: WAInteractiveReply;
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
