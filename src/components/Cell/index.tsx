import React from "react";

interface Props {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  colorClassName: string;
  onClick: () => void;
}

const Cell = ({
  onMouseEnter,
  onMouseLeave,
  colorClassName,
  onClick,
}: Props) => {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`grid-cell ${colorClassName}`}
    />
  );
};

export default Cell;
