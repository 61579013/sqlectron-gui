import debounce from 'lodash.debounce';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Grid, ScrollSync } from 'react-virtualized';
import Draggable from 'react-draggable';

import scrollbarSize from 'dom-helpers/scrollbarSize';
import TableCell from './query-result-table-cell';
import PreviewModal from './preview-modal';
import { valueToString } from '../utils/convert';

import 'react-virtualized/styles.css';
import './query-result-table.scss';

/* eslint react/sort-comp:0 */
export default class QueryResultTable extends Component {
  static propTypes = {
    config: PropTypes.object.isRequired,
    widthOffset: PropTypes.number.isRequired,
    heigthOffset: PropTypes.number.isRequired,
    onCopyToClipboardClick: PropTypes.func.isRequired,
    onSaveToFileClick: PropTypes.func.isRequired,
    resultItemsPerPage: PropTypes.number.isRequired,
    copied: PropTypes.bool,
    saved: PropTypes.bool,
    query: PropTypes.string,
    fields: PropTypes.array,
    rows: PropTypes.array,
    cellClass: PropTypes.string,
    nullCellClass: PropTypes.string,
    rowCount: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.number,
    ]),
  }

  constructor(props, context) {
    super(props, context);
    this.state = {
      columnWidths: {},
      autoColumnWidths: [],
    };

    this.onResize = this.onResize.bind(this);
    this.resize = this.resize.bind(this);
    this.onClosePreviewClick = this.onClosePreviewClick.bind(this);
    this.renderCell = this.renderCell.bind(this);
    this.getColumnWidth = this.getColumnWidth.bind(this);
    this.renderNoRows = this.renderNoRows.bind(this);
    this.renderHeaderCell = this.renderHeaderCell.bind(this);
    this.onOpenPreviewClick = this.onOpenPreviewClick.bind(this);

    this.resizeHandler = debounce(this.onResize, 20);
  }

  componentDidMount() {
    window.addEventListener('resize', this.resizeHandler, false);
    this.resize();
  }

  componentWillReceiveProps(nextProps) {
    this.resize(nextProps);

    if (nextProps.widthOffset !== this.props.widthOffset) {
      if (this.rowsGrid) {
        this.rowsGrid.recomputeGridSize();
      }
      if (this.headerGrid) {
        this.headerGrid.recomputeGridSize();
      }
    }

    if (nextProps.copied) {
      this.setState({ showCopied: true });
    }

    if (nextProps.saved) {
      this.setState({ showSaved: true });
    }
  }

  componentDidUpdate() {
    if (this.state.showCopied) {
      /* eslint react/no-did-update-set-state: 0 */
      setTimeout(() => this.setState({ showCopied: false }), 1000);
    }

    if (this.state.showSaved) {
      /* eslint react/no-did-update-set-state: 0 */
      setTimeout(() => this.setState({ showSaved: false }), 1000);
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.resizeHandler, false);
  }

  onColumnResizeEndCallback(newColumnWidth, columnKey) {
    this.setState(({ columnWidths }) => ({
      columnWidths: {
        ...columnWidths,
        [columnKey]: newColumnWidth,
      },
    }));
  }

  onOpenPreviewClick(value) {
    this.setState({ showPreview: true, valuePreview: value });
  }

  onClosePreviewClick() {
    this.setState({ showPreview: false, valuePreview: null });
  }

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(this.resize, 16);
  }

  getTextWidth(text, font) {
    // additional spacing
    const padding = 28;
    const element = document.createElement('canvas');
    const context = element.getContext('2d');
    context.font = font;
    return context.measureText(text).width + padding;
  }

  autoResizeColumnsWidth(fields, rows, tableWidth) {
    const averageTableCellWidth = tableWidth / fields.length;
    let totalColumnWidths = 0;

    const autoColumnWidths = fields.map((name, index) => {
      const cellWidth = this.resolveCellWidth(name, fields, rows, averageTableCellWidth);
      totalColumnWidths += cellWidth;

      const isLastColumn = (index + 1) === fields.length;
      if (isLastColumn && totalColumnWidths < tableWidth) {
        totalColumnWidths -= cellWidth;
        return tableWidth - totalColumnWidths;
      }

      return cellWidth;
    });

    this.setState({ autoColumnWidths });
  }

  renderHeaderCell(params) {
    const field = this.props.fields[params.columnIndex];
    const handleStop = this.handleStop.bind(this, { name: field.name, index: params.columnIndex });

    // We don't want the resizable handle on the last column for layout reasons
    let resizeDrag = null;
    if ((this.props.fields.length - 1) !== params.columnIndex) {
      resizeDrag = (
        <Draggable
          axis="x"
          onStop={handleStop}
          position={{ x: 0, y: 0 }}
          zIndex={999}>
          <div className="draggable-handle" />
        </Draggable>
      );
    }

    return (
      <div className="item">
        <span>{field.name}</span>
        {resizeDrag}
      </div>
    );
  }

  renderNoRows() {
    return (
      <div style={{ textAlign: 'center', fontSize: '16px' }}>
        No results found
      </div>
    );
  }

  handleStop(data, e, move) {
    const { columnWidths } = this.state;
    const originalWidth = this.getColumnWidth(data);

    // update dragged column width
    this.setState({
      columnWidths: {
        ...columnWidths,
        [data.name]: Math.max((originalWidth + move.x), 10),
      },
    });

    if (this.headerGrid) {
      this.headerGrid.measureAllCells();
      this.headerGrid.recomputeGridSize();
      this.headerGrid.forceUpdate();
    }

    if (this.rowsGrid) {
      this.rowsGrid.measureAllCells();
      this.rowsGrid.recomputeGridSize();
      this.rowsGrid.forceUpdate();
    }
  }

  resize(nextProps) {
    const props = nextProps || this.props;
    const tableWidth = window.innerWidth - (props.widthOffset + 27);
    const tableHeight = window.innerHeight - (props.heigthOffset + 225);

    // trigger columns resize
    this.autoResizeColumnsWidth(props.fields, props.rows, tableWidth);

    this.setState({ tableWidth, tableHeight });
  }

  renderHeaderTopBar() {
    const {
      rows, rowCount, onCopyToClipboardClick, onSaveToFileClick,
    } = this.props;
    const csvDelimiter = this.props.config.data.csvDelimiter || ',';
    const styleCopied = { display: this.state.showCopied ? 'inline-block' : 'none' };
    const styleSaved = { display: this.state.showSaved ? 'inline-block' : 'none' };
    const styleCopyButtons = { display: this.state.showCopied ? 'none' : 'inline-block' };
    const styleSaveButtons = { display: this.state.showSaved ? 'none' : 'inline-block' };

    let copyPanel = null;
    let savePanel = null;
    if (rowCount) {
      copyPanel = (
        <div className="ui small label" title="Copy as" style={{ float: 'right', margin: '3px' }}>
          <i className="copy icon" />
          <a className="detail" style={styleCopied}>Copied</a>
          <a className="detail"
            style={styleCopyButtons}
            onClick={() => onCopyToClipboardClick(rows, 'CSV', csvDelimiter)}>
            CSV
          </a>
          <a className="detail"
            style={styleCopyButtons}
            onClick={() => onCopyToClipboardClick(rows, 'JSON')}>
            JSON
          </a>
        </div>
      );

      savePanel = (
        <div className="ui small label" title="Save as" style={{ float: 'right', margin: '3px' }}>
          <i className="save icon" />
          <a className="detail" style={styleSaved}>Saved</a>
          <a className="detail"
            style={styleSaveButtons}
            onClick={() => onSaveToFileClick(rows, 'CSV', csvDelimiter)}>
            CSV
          </a>
          <a className="detail"
            style={styleSaveButtons}
            onClick={() => onSaveToFileClick(rows, 'JSON')}>
            JSON
          </a>
        </div>
      );
    }

    return (
      <div style={{ background: 'rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <div className="ui label" style={{ margin: '3px', float: 'left' }}>
          <i className="table icon" />
          Rows
          <div className="detail">{rowCount}</div>
        </div>
        {savePanel}
        {copyPanel}
      </div>
    );
  }

  renderPreviewModal() {
    if (!this.state.showPreview) {
      return null;
    }

    return (
      <PreviewModal
        value={this.state.valuePreview}
        onCloseClick={this.onClosePreviewClick}
      />
    );
  }

  renderTableBody(onScroll) {
    const { rowCount, fields } = this.props;
    const { tableWidth, tableHeight } = this.state;

    const headerHeight = 62; // value of 2 headers together
    const scrollBarHeight = 15;
    const rowHeight = 28;
    const fixedHeightRows = ((rowCount || 1) * rowHeight) + scrollBarHeight;

    return (
      <Grid
        className="grid-body"
        ref={(ref) => { this.rowsGrid = ref; }}
        cellRenderer={this.renderCell}
        width={tableWidth}
        height={Math.min((tableHeight - headerHeight), fixedHeightRows)}
        rowHeight={rowHeight}
        onScroll={onScroll}
        rowCount={rowCount}
        columnCount={fields.length}
        columnWidth={this.getColumnWidth}
        rowsCount={rowCount}
        noContentRenderer={this.renderNoRows} />

    );
  }

  renderTableHeader(scrollLeft) {
    const { fields } = this.props;
    const { tableWidth } = this.state;

    if (!fields.length) {
      return null;
    }

    return (
      <Grid
        ref={(ref) => { this.headerGrid = ref; }}
        columnWidth={this.getColumnWidth}
        columnCount={fields.length}
        height={30}
        cellRenderer={this.renderHeaderCell}
        className="grid-header-row"
        rowHeight={30}
        rowCount={1}
        width={tableWidth - scrollbarSize()}
        scrollLeft={scrollLeft} />
    );
  }

  getColumnWidth({ index }) {
    const { columnWidths, autoColumnWidths } = this.state;
    const field = this.props.fields[index];

    if (field && columnWidths && columnWidths[field.name] !== undefined) {
      return columnWidths[field.name];
    } if (autoColumnWidths && autoColumnWidths[index] !== undefined) {
      return autoColumnWidths[index];
    }
    return 50;
  }

  /**
   * Resolve the cell width based in the header name and the top 30 rows data.
   * It gives a better UX since the column adapts better to the table width.
   */
  resolveCellWidth(fieldName, fields, rows) {
    const customFont = this.props.config.data.customFont || 'Lato';
    const font = `14px '${customFont}', 'Helvetica Neue', Arial, Helvetica, sans-serif`;
    const numRowsToFindAverage = rows.length > 30 ? 30 : rows.length;
    const maxWidth = 220;
    const headerWidth = this.getTextWidth(fieldName, `bold ${font}`);
    let averageRowsCellWidth = 0;
    if (rows.length) {
      averageRowsCellWidth = rows
        .slice(0, numRowsToFindAverage)
        .map((row) => {
          const value = valueToString(row[fieldName]);
          return this.getTextWidth(value, font);
        })
        .reduce((prev, curr) => prev + curr, 0) / numRowsToFindAverage;
    }

    if (headerWidth > averageRowsCellWidth) {
      return headerWidth > maxWidth ? maxWidth : headerWidth;
    }

    return averageRowsCellWidth > maxWidth ? maxWidth : averageRowsCellWidth;
  }

  renderCell(params) {
    const field = this.props.fields[params.columnIndex];
    return (
      <TableCell
        rowIndex={params.rowIndex}
        data={this.props.rows}
        col={field.name}
        onOpenPreviewClick={this.onOpenPreviewClick} />
    );
  }

  render() {
    // not completed loaded yet
    if (!this.state.tableWidth) {
      return null;
    }

    return (
      <div>
        {this.renderPreviewModal()}

        <ScrollSync>
          {({ onScroll, scrollLeft }) => (
            <div className="grid-query-wrapper">
              {this.renderHeaderTopBar()}
              {this.renderTableHeader(scrollLeft)}
              {this.renderTableBody(onScroll)}
            </div>
          )}
        </ScrollSync>
      </div>
    );
  }
}
