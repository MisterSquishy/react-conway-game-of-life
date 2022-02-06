import React from "react";
import { Rect } from "react-konva";
import { CELL_STATE } from "../../shapes";

interface Props {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  coords: {
    row: number;
    col: number;
  };
  cellState: CELL_STATE;
}

const Cell = ({
  onMouseEnter,
  onMouseLeave,
  onClick,
  coords,
  cellState,
}: Props) => {
  return (
    <Rect
      x={coords.col * 15}
      y={coords.row * 15}
      width={15}
      height={15}
      stroke="0.5px solid black"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      fill={
        cellState === CELL_STATE.ALIVE
          ? "#007ea6"
          : cellState === CELL_STATE.HOVERED
          ? "#d7cd4e"
          : cellState === CELL_STATE.STARVING
          ? "#88a990"
          : ""
      }
    />
  );
};

export default Cell;
