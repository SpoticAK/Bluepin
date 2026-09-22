import React from "react";

export const CustomFlameEmoji = ({
  className = "w-6 h-6",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer Flame Body */}
    <path
      d="M50 5 C30 25 10 45 10 65 A40 40 0 0 0 90 65 C90 45 70 25 50 5 Z"
      fill="#FF5F45"
      stroke="#4B2117"
      strokeWidth="5"
      strokeLinejoin="round"
    />
    {/* Inner Flame Highlight */}
    <path
      d="M50 25 C38 40 22 55 22 70 A28 25 0 0 0 78 70 C78 55 62 40 50 25 Z"
      fill="#FFAD38"
    />

    {/* Blush */}
    <ellipse cx="28" cy="65" rx="6" ry="4" fill="#FF5F45" />
    <ellipse cx="72" cy="65" rx="6" ry="4" fill="#FF5F45" />

    {/* Eyes */}
    <circle cx="36" cy="60" r="4.5" fill="#4B2117" />
    <circle cx="34.5" cy="58.5" r="1.5" fill="#FFFFFF" />

    <circle cx="64" cy="60" r="4.5" fill="#4B2117" />
    <circle cx="62.5" cy="58.5" r="1.5" fill="#FFFFFF" />

    {/* Smile */}
    <path
      d="M 45 65 Q 50 72 55 65"
      fill="none"
      stroke="#4B2117"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

export const CustomSmileEmoji = ({
  className = "w-6 h-6",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="50"
      cy="50"
      r="44"
      fill="#FFF100"
      stroke="#000000"
      strokeWidth="4"
    />
    <circle cx="35" cy="40" r="5" fill="#000000" />
    <circle cx="65" cy="40" r="5" fill="#000000" />
    <path
      d="M 30 60 Q 50 78 70 60"
      fill="none"
      stroke="#000000"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);

export const CustomCheckEmoji = ({
  className = "w-6 h-6",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
      fill="#3A7D44"
    />
  </svg>
);

export const CustomCrossEmoji = ({
  className = "w-6 h-6",
}: {
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
      fill="#C94C4C"
    />
  </svg>
);

export const WhatsAppIcon = ({
  className = "w-5 h-5",
  size = 20,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.276-.1-.476-.15-.676.15-.2.301-.776.978-.952 1.179-.176.2-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.894-.798-1.498-1.784-1.674-2.085-.175-.301-.019-.464.132-.614.135-.135.301-.351.451-.527.151-.176.2-.301.301-.502.101-.2.05-.376-.025-.526-.075-.15-.677-1.632-.927-2.235-.244-.588-.492-.508-.676-.517-.175-.008-.376-.01-.577-.01-.2 0-.526.075-.802.376-.275.301-1.053 1.028-1.053 2.508 0 1.48 1.078 2.909 1.229 3.11.15.201 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.634.721.229 1.377.197 1.895.12.578-.087 1.78-.727 2.03-1.43.251-.703.251-1.305.176-1.43-.075-.126-.276-.201-.577-.351zM12.04 2C6.52 2 2.03 6.49 2.03 12.01c0 1.98.58 3.86 1.68 5.46L2 22l4.67-1.64c1.55 1 3.37 1.55 5.37 1.55 5.52 0 10.01-4.49 10.01-10.01C22.05 6.49 17.56 2 12.04 2zm0 18.25c-1.77 0-3.43-.53-4.83-1.45l-.35-.23-2.77.97.98-2.7-.23-.37a8.21 8.21 0 0 1-1.26-4.46c0-4.55 3.71-8.26 8.26-8.26 4.55 0 8.26 3.71 8.26 8.26 0 4.56-3.71 8.26-8.26 8.26z" />
  </svg>
);
