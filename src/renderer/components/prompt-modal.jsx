import React, { Component } from 'react';
import PropTypes from 'prop-types';


export default class PromptModal extends Component {
  static propTypes = {
    onCancelClick: PropTypes.func.isRequired,
    onOKClick: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  componentDidMount() {
    $(this.refs.promptModal).modal({
      closable: false,
      detachable: false,
      onDeny: () => {
        this.props.onCancelClick();
        return true;
      },
      onApprove: () => {
        this.props.onOKClick(this.state.value);
        return true;
      },
    }).modal('show');
  }

  componentWillUnmount() {
    $(this.refs.promptModal).modal('hide');
  }

  handleKeyPress(event) {
    if (event.key === 'Enter') {
      this.props.onOKClick(this.state.value);
    }
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  render() {
    const { title, message, type } = this.props;

    return (
      <div className="ui modal" ref="promptModal">
        <div className="header">
          {title}
        </div>
        <div className="content">
          {message}
          <div className="ui fluid icon input">
            <input onChange={this.handleChange} type={type} onKeyPress={this.handleKeyPress} />
          </div>
        </div>
        <div className="actions">
          <div className="small ui black deny right labeled icon button" tabIndex="0">
            Cancel
            <i className="ban icon" />
          </div>
          <div className="small ui positive right labeled icon button" tabIndex="0">
            OK
            <i className="checkmark icon" />
          </div>
        </div>
      </div>
    );
  }
}
