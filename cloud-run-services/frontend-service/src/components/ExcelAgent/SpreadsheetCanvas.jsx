import { useState, useCallback, memo, useRef, useLayoutEffect } from 'react';
import './ExcelAgent.css';

// Convert column index to Excel-style lettering (0→A, 25→Z, 26→AA, …)
function colLabel(idx) {
    let s = '';
    let i = idx + 1;
    while (i > 0) {
        const rem = (i - 1) % 26;
        s = String.fromCharCode(65 + rem) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}

const SpreadsheetCanvas = memo(({ data, onCellChange, changedRows, cellStyles = {} }) => {
    const [editCell, setEditCell] = useState(null); // { row, col }
    const [editValue, setEditValue] = useState('');

    const numRows = data.length;
    const numCols = Math.max(...data.map(r => r.length), 0);

    // virtualization state
    const ROW_HEIGHT = 28; // must match CSS (.spreadsheet-table td padding etc)
    const containerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const updateHeight = () => setContainerHeight(el.clientHeight);
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // also refresh height when number of rows changes (might affect scrollbar size)
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (el) setContainerHeight(el.clientHeight);
    }, [numRows]);

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };

    const visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT) + 10; // buffer
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const endIdx = Math.min(numRows, startIdx + visibleRowCount);
    const topPadding = startIdx * ROW_HEIGHT;
    const bottomPadding = (numRows - endIdx) * ROW_HEIGHT;

    const startEdit = (row, col) => {
        setEditCell({ row, col });
        setEditValue(String(data[row]?.[col] ?? ''));
    };

    const commitEdit = useCallback(() => {
        if (!editCell) return;
        onCellChange(editCell.row, editCell.col, editValue);
        setEditCell(null);
    }, [editCell, editValue, onCellChange]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') { setEditCell(null); }
        if (e.key === 'Tab') { e.preventDefault(); commitEdit(); }
    };

    if (numRows === 0) return null;

    // slice data for visible range
    const visibleData = data.slice(startIdx, endIdx);

    return (
        <div
            className="spreadsheet-wrapper"
            ref={containerRef}
            onScroll={handleScroll}
        >
            <table className="spreadsheet-table">
                <thead>
                    <tr>
                        <th className="corner-header" />
                        {Array.from({ length: numCols }, (_, ci) => (
                            <th key={ci}>{colLabel(ci)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {/* top padding row */}
                    {topPadding > 0 && (
                        <tr style={{ height: topPadding }}>
                            <td colSpan={numCols + 1} />
                        </tr>
                    )}

                    {visibleData.map((row, idx) => {
                        const ri = startIdx + idx;
                        return (
                            <tr key={ri} className={changedRows.includes(ri) ? 'ai-changed' : ''}>
                                <td className="row-header">{ri + 1}</td>
                                {Array.from({ length: numCols }, (_, ci) => {
                                    const isEditing = editCell?.row === ri && editCell?.col === ci;
                                    const value = row[ci] ?? '';
                                    return (
                                        <td key={ci}>
                                            {isEditing ? (
                                                <input
                                                    className="cell-input"
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={handleKeyDown}
                                                />
                                            ) : (
                                                <div
                                                    className="cell-inner"
                                                    onDoubleClick={() => startEdit(ri, ci)}
                                                    title={String(value)}
                                                    style={cellStyles[`${ri}-${ci}`] || {}}
                                                >
                                                    {String(value)}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}

                    {/* bottom padding row */}
                    {bottomPadding > 0 && (
                        <tr style={{ height: bottomPadding }}>
                            <td colSpan={numCols + 1} />
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});

SpreadsheetCanvas.displayName = 'SpreadsheetCanvas';
export default SpreadsheetCanvas;
