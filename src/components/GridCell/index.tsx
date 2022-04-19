import React from "react";
import { Rect } from "react-konva";
import { Cell, TEAM } from "../../App";
import { CELL_STATE } from "../../shapes";

interface Props {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  coords: {
    row: number;
    col: number;
  };
  cell: Cell;
}

const COLORS: Record<TEAM, string> = {
  blue: "blue",
  red: "red",
};

const GridCell = ({
  onMouseEnter,
  onMouseLeave,
  onClick,
  coords,
  cell,
}: Props) => {
  const aliveColor = COLORS[cell.team || "blue"];
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
        cell.state === CELL_STATE.ALIVE
          ? aliveColor
          : cell.state === CELL_STATE.HOVERED
          ? aliveColor
          : ""
      }
      opacity={cell.state === CELL_STATE.HOVERED ? 0.25 : 1}
    />
  );
};

export default GridCell;
