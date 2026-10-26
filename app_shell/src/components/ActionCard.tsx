import React from "react";

interface ActionCardProps {
  title: string;
  description: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  isActive,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "18px",
        borderRadius: "12px",
        background: isActive ? "rgba(255, 71, 87, 0.12)" : "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${isActive ? "rgba(255, 71, 87, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f2f6" }}>{title}</div>
      <div style={{ fontSize: "12px", color: "#a4b0be", marginTop: "4px" }}>{description}</div>
    </div>
  );
};
