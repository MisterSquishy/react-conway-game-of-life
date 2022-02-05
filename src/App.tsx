import { Button, InputNumber, Layout, PageHeader, Select, Space } from "antd";
import Modal from "antd/lib/modal/Modal";
import produce from "immer";
import React, { useCallback, useRef, useState } from "react";
import "./App.css";
import SHAPES, { CELL_STATE, PREFABS } from "./shapes";
const { Option, OptGroup } = Select;

const aliveColor = "#007EA6";

const numRows = 30;
const numCols = 100;

interface CellState {
  previous: CELL_STATE;
  current: CELL_STATE;
  next: CELL_STATE;
}

type Grid = CellState[][];

const SHAPE_GROUPS = {
  Stables: [PREFABS.BEEHIVE, PREFABS.BEEHIVE_WITH_TAIL, PREFABS.MIRRORED_TABLE],
  Oscillators: [PREFABS.BLINKER, PREFABS.TUMBLER, PREFABS.QUEEN_BEE_SHUTTLE],
  Gliders: [PREFABS.GLIDER],
};

const operations = [
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, 0],
  [-1, 0],
];

const generateEmptyGrid = (): Grid => {
  const rows = [];
  for (let i = 0; i < numRows; i++) {
    rows.push(
      Array.from(Array(numCols), () => ({
        previous: CELL_STATE.DEAD,
        current: CELL_STATE.DEAD,
        next: CELL_STATE.DEAD,
      }))
    );
  }

  return rows;
};

const App: React.FC = () => {
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<[number, number]>();
  const [cursorType, setCursorType] = useState<PREFABS>(PREFABS.POINT);
  const intervalMs = useRef(100);
  const generation = useRef(0);

  const [grid, setGrid] = useState(() => {
    return generateEmptyGrid();
  });

  const [running, setRunning] = useState(false);

  const runningRef = useRef(running);
  runningRef.current = running;

  const runSimulation = useCallback(() => {
    if (!runningRef.current) {
      return;
    }

    generation.current++;
    setGrid((g) => {
      return produce(g, (gridCopy) => {
        // set previous and current
        for (let i = 0; i < numRows; i++) {
          for (let k = 0; k < numCols; k++) {
            gridCopy[i][k].previous = gridCopy[i][k].current;
            let livingNeighbors = 0;
            operations.forEach(([x, y]) => {
              const newI = i + x;
              const newK = k + y;
              if (newI >= 0 && newI < numRows && newK >= 0 && newK < numCols) {
                const neighborIsAlive =
                  g[newI][newK].current === CELL_STATE.ALIVE;
                livingNeighbors += neighborIsAlive ? 1 : 0;
              }
            });

            if (livingNeighbors < 2 || livingNeighbors > 3) {
              gridCopy[i][k].current = CELL_STATE.DEAD;
            } else if (
              g[i][k].current === CELL_STATE.DEAD &&
              livingNeighbors === 3
            ) {
              gridCopy[i][k].current = CELL_STATE.ALIVE;
            }
          }
        }
        // set next
        for (let i = 0; i < numRows; i++) {
          for (let k = 0; k < numCols; k++) {
            let livingNeighbors = 0;
            operations.forEach(([x, y]) => {
              const newI = i + x;
              const newK = k + y;
              if (newI >= 0 && newI < numRows && newK >= 0 && newK < numCols) {
                const neighborIsAlive =
                  g[newI][newK].current === CELL_STATE.ALIVE;
                livingNeighbors += neighborIsAlive ? 1 : 0;
              }
            });
            if (livingNeighbors < 2 || livingNeighbors > 3) {
              gridCopy[i][k].next = CELL_STATE.DEAD;
            } else if (
              g[i][k].current === CELL_STATE.DEAD &&
              livingNeighbors === 3
            ) {
              gridCopy[i][k].next = CELL_STATE.ALIVE;
            } else if (
              g[i][k].current === CELL_STATE.ALIVE &&
              livingNeighbors >= 2 &&
              livingNeighbors <= 3
            ) {
              gridCopy[i][k].next = CELL_STATE.ALIVE;
            }
          }
        }
      });
    });

    setTimeout(runSimulation, intervalMs.current);
  }, [generation, intervalMs]);

  const cellColorStyle = (i: number, k: number) => {
    const cellState = grid[i][k];
    if (cellState.current === CELL_STATE.ALIVE) {
      if (hoveredCell && hoveredCell[0] === i && hoveredCell[1] === k) {
        return {
          backgroundColor: aliveColor,
          opacity: 0.3,
        };
      } else if (
        cellState.previous === CELL_STATE.DEAD ||
        cellState.next === CELL_STATE.DEAD
      ) {
        return {
          backgroundColor: aliveColor,
          opacity: 0.6,
        };
      } else {
        return { backgroundColor: aliveColor };
      }
    } else if (cellState.current === CELL_STATE.DEAD) {
      if (hoveredCell && hoveredCell[0] === i && hoveredCell[1] === k) {
        return {
          backgroundColor: aliveColor,
          opacity: 0.6,
        };
      } else if (
        cellState.previous !== CELL_STATE.DEAD ||
        cellState.next !== CELL_STATE.DEAD
      ) {
        return {
          backgroundColor: aliveColor,
          opacity: 0.3,
        };
      }
    }
  };

  return (
    <Layout
      style={{
        padding: "32px",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Modal
        title="Da Rules"
        width="1050px"
        visible={rulesModalOpen}
        onCancel={() => setRulesModalOpen(false)}
        footer={null}
      >
        <iframe
          title="Conway's Game of Life"
          src="https://conwaylife.com/wiki/Conway%27s_Game_of_Life#Rules"
          width="1000px"
          height="500px"
        />
      </Modal>
      <PageHeader
        title="John Conway's Game of Life"
        subTitle={
          <Button type="link" onClick={() => setRulesModalOpen(true)}>
            What is this?
          </Button>
        }
      />
      <Space direction="vertical" size="large">
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          <Button
            type="primary"
            onClick={() => {
              setRunning(!running);
              if (!running) {
                runningRef.current = true;
                runSimulation();
              }
            }}
          >
            {running ? "stop" : "start"}
          </Button>
          <Button
            type="default"
            onClick={() => {
              generation.current = 0;
              setRunning(false);
              const rows = [];
              for (let i = 0; i < numRows; i++) {
                rows.push(
                  Array.from(Array(numCols), () =>
                    Math.random() > 0.7
                      ? {
                          current: CELL_STATE.ALIVE,
                          next: CELL_STATE.ALIVE,
                          previous: CELL_STATE.ALIVE,
                        }
                      : {
                          current: CELL_STATE.DEAD,
                          next: CELL_STATE.DEAD,
                          previous: CELL_STATE.DEAD,
                        }
                  )
                );
              }

              setGrid(rows);
            }}
          >
            random
          </Button>
          <Button
            danger
            onClick={() => {
              generation.current = 0;
              setRunning(false);
              setGrid(generateEmptyGrid());
            }}
          >
            clear
          </Button>
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          Prefab
          <Select
            defaultValue={cursorType}
            onChange={setCursorType}
            style={{ width: "200px" }}
          >
            <Option value={PREFABS.POINT}>POINT</Option>
            {Object.entries(SHAPE_GROUPS).map(([key, cursorTypes]) => (
              <OptGroup label={key} key={key}>
                {cursorTypes.map((value, key) => (
                  <Option value={value} key={`${value}-${key}`}>
                    {PREFABS[value]}
                  </Option>
                ))}
              </OptGroup>
            ))}
          </Select>
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          Generation duration (ms)
          <InputNumber
            value={intervalMs.current}
            onChange={(val) => (intervalMs.current = val)}
          />
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          generation {generation.current}
        </Space>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${numCols}, 15px)`,
          }}
        >
          {grid.map((rows, i) =>
            rows.map((col, k) => (
              <div
                key={`${i}-${k}`}
                onClick={() => {
                  const cursorShape = SHAPES[cursorType];
                  const newGrid = produce(grid, (gridCopy) => {
                    var startRow = i;
                    var startCol = k;
                    if (numRows < i + cursorShape.length) {
                      // shape would run off bottom of grid
                      startRow = numRows - cursorShape.length;
                    }
                    if (numCols < k + cursorShape[0].length) {
                      // shape would run off right of grid
                      startCol = numCols - cursorShape[0].length;
                    }
                    for (var row = 0; row < cursorShape.length; row++) {
                      for (var col = 0; col < cursorShape[row].length; col++) {
                        gridCopy[startRow + row][startCol + col].current =
                          cursorShape[row][col];
                      }
                    }
                  });
                  setGrid(newGrid);
                }}
                onMouseEnter={() => setHoveredCell([i, k])}
                onMouseLeave={() => setHoveredCell(undefined)}
                style={{
                  width: 15,
                  height: 15,
                  border: "solid 0.5px black",
                  ...cellColorStyle(i, k),
                }}
              />
            ))
          )}
        </div>
      </Space>
    </Layout>
  );
};

export default App;
