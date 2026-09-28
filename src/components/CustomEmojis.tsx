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
  size = 20,
  className = "size-5",
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    viewBox="0 0 16 16"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
    <g
      id="SVGRepo_tracerCarrier"
      stroke-linecap="round"
      stroke-linejoin="round"
    ></g>
    <g id="SVGRepo_iconCarrier">
      <path d="M11.42 9.49c-.19-.09-1.1-.54-1.27-.61s-.29-.09-.42.1-.48.6-.59.73-.21.14-.4 0a5.13 5.13 0 0 1-1.49-.92 5.25 5.25 0 0 1-1-1.29c-.11-.18 0-.28.08-.38s.18-.21.28-.32a1.39 1.39 0 0 0 .18-.31.38.38 0 0 0 0-.33c0-.09-.42-1-.58-1.37s-.3-.32-.41-.32h-.4a.72.72 0 0 0-.5.23 2.1 2.1 0 0 0-.65 1.55A3.59 3.59 0 0 0 5 8.2 8.32 8.32 0 0 0 8.19 11c.44.19.78.3 1.05.39a2.53 2.53 0 0 0 1.17.07 1.93 1.93 0 0 0 1.26-.88 1.67 1.67 0 0 0 .11-.88c-.05-.07-.17-.12-.36-.21z"></path>
      <path d="M13.29 2.68A7.36 7.36 0 0 0 8 .5a7.44 7.44 0 0 0-6.41 11.15l-1 3.85 3.94-1a7.4 7.4 0 0 0 3.55.9H8a7.44 7.44 0 0 0 5.29-12.72zM8 14.12a6.12 6.12 0 0 1-3.15-.87l-.22-.13-2.34.61.62-2.28-.14-.23a6.18 6.18 0 0 1 9.6-7.65 6.12 6.12 0 0 1 1.81 4.37A6.19 6.19 0 0 1 8 14.12z"></path>
    </g>
  </svg>
);
