/* eslint-disable react/prop-types */
// todo remove eslint prop-types rule
import React from 'react';
import { nanoid } from 'nanoid';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { formatClientCell } from '../../../helpers/formatClientCell';
import {
    checkFiltered, formatElapsedMs, captitalizeWords, formatDateTime, formatTime,
} from '../../../helpers/helpers';
import {
    BLOCK_ACTIONS, FILTERED_STATUS,
    FILTERED_STATUS_TO_META_MAP,
    DEFAULT_SHORT_DATE_FORMAT_OPTIONS,
    LONG_TIME_FORMAT,
    SCHEME_TO_PROTOCOL_MAP,
    DEFAULT_TIME_FORMAT, CUSTOM_FILTERING_RULES_ID, QUERY_STATUS_COLORS,
} from '../../../helpers/constants';
import getIconTooltip from './getIconTooltip';

import { getSourceData } from '../../../helpers/trackers/trackers';
import { toggleBlocking } from '../../../actions';
import '../Test.css';
import '../Logs.css';
import Loading from '../../ui/Loading';

const getFilterName = (filters, whitelistFilters, filterId, t) => {
    if (filterId === CUSTOM_FILTERING_RULES_ID) {
        return t('custom_filter_rules');
    }

    const filter = filters.find((filter) => filter.id === filterId)
            || whitelistFilters.find((filter) => filter.id === filterId);
    let filterName = '';

    if (filter) {
        filterName = filter.name;
    }

    if (!filterName) {
        filterName = t('unknown_filter', { filterId });
    }

    return filterName;
};

const DateCell = ({ time }) => {
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);

    if (!time) {
        return '–';
    }

    const formattedTime = formatTime(time, DEFAULT_TIME_FORMAT);
    const formattedDate = formatDateTime(time, DEFAULT_SHORT_DATE_FORMAT_OPTIONS);

    return <div className="logs__cell logs__cell logs__cell--date">
        <div className="logs__time" title={formattedTime}>{formattedTime}</div>
        {isDetailed && <div className="detailed-info d-none d-sm-block text-truncate"
                            title={formattedDate}>{formattedDate}</div>}
    </div>;
};

const DomainCell = (props) => {
    const {
        answer_dnssec,
        client_proto,
        domain,
        time,
        tracker,
        type,
    } = props;

    const { t } = useTranslation();
    const dnssec_enabled = useSelector((state) => state.dnsConfig.dnssec_enabled);
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);

    const hasTracker = !!tracker;

    const lockIconClass = classNames('icons icon--24 d-none d-sm-block', {
        'icon--green': answer_dnssec,
        'icon--disabled': !answer_dnssec,
        'my-3': isDetailed,
    });

    const privacyIconClass = classNames('icons mx-2 icon--24 d-none d-sm-block', {
        'icon--green': hasTracker,
        'icon--disabled': !hasTracker,
        'my-3': isDetailed,
    });

    const protocol = t(SCHEME_TO_PROTOCOL_MAP[client_proto]) || '';
    const ip = type ? `${t('type_table_header')}: ${type}` : '';

    const requestDetailsObj = {
        time_table_header: formatTime(time, LONG_TIME_FORMAT),
        date: formatDateTime(time, DEFAULT_SHORT_DATE_FORMAT_OPTIONS),
        domain,
        type_table_header: type,
        protocol,
    };

    const sourceData = getSourceData(tracker);

    const knownTrackerDataObj = {
        name_table_header: tracker?.name,
        category_label: hasTracker && captitalizeWords(tracker.category),
        source_label: sourceData
                && <a href={sourceData.url} target="_blank" rel="noopener noreferrer"
                      className="link--green">{sourceData.name}</a>,
    };

    const renderGrid = (content, idx) => {
        const preparedContent = typeof content === 'string' ? t(content) : content;
        const className = classNames('text-truncate o-hidden', {
            'overflow-break': preparedContent.length > 100,
        });
        return <div key={idx} className={className}>{preparedContent}</div>;
    };

    const getGrid = (contentObj, title, className) => [
        <div key={title} className={classNames('pb-2 grid--title', className)}>{t(title)}</div>,
        <div key={`${title}-1`}
             className="grid grid--limited">{React.Children.map(Object.entries(contentObj), renderGrid)}</div>,
    ];

    const requestDetails = getGrid(requestDetailsObj, 'request_details');

    const renderContent = hasTracker ? requestDetails.concat(getGrid(knownTrackerDataObj, 'known_tracker', 'pt-4')) : requestDetails;

    const trackerHint = getIconTooltip({
        className: privacyIconClass,
        tooltipClass: 'pt-4 pb-5 px-5 mw-75',
        xlinkHref: 'privacy',
        contentItemClass: 'key-colon',
        renderContent,
        place: 'bottom',
    });

    const valueClass = classNames('w-100', {
        'px-2 d-flex justify-content-center flex-column': isDetailed,
    });

    const details = [ip, protocol].filter(Boolean)
        .join(', ');

    return <div className="logs__row o-hidden logs__cell logs__cell logs__cell--domain">
        {dnssec_enabled && getIconTooltip({
            className: lockIconClass,
            tooltipClass: 'py-4 px-5 pb-45',
            canShowTooltip: answer_dnssec,
            xlinkHref: 'lock',
            columnClass: 'w-100',
            content: 'validated_with_dnssec',
            placement: 'bottom',
        })}
        {trackerHint}
        <div className={valueClass}>
            <div className="text-truncate" title={domain}>{domain}</div>
            {details && isDetailed
            && <div className="detailed-info d-none d-sm-block text-truncate"
                    title={details}>{details}</div>}
        </div>
    </div>;
};


const ResponseCell = ({
    elapsedMs,
    originalResponse,
    reason,
    response,
    status,
    upstream,
    rule,
    filterId,
}) => {
    const { t } = useTranslation();
    const { filters, whitelistFilters } = useSelector((state) => state.filtering);
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);

    const formattedElapsedMs = formatElapsedMs(elapsedMs, t);

    const isBlocked = reason === FILTERED_STATUS.FILTERED_BLACK_LIST
            || reason === FILTERED_STATUS.FILTERED_BLOCKED_SERVICE;

    const isBlockedByResponse = originalResponse.length > 0 && isBlocked;

    const statusLabel = t(isBlockedByResponse ? 'blocked_by_cname_or_ip' : FILTERED_STATUS_TO_META_MAP[reason]?.label || reason);
    const boldStatusLabel = <span className="font-weight-bold">{statusLabel}</span>;
    const filter = getFilterName(filters, whitelistFilters, filterId, t);

    const renderResponses = (responseArr) => {
        if (responseArr?.length === 0) {
            return '';
        }

        return <div>{responseArr.map((response) => {
            const className = classNames('white-space--nowrap', {
                'overflow-break': response.length > 100,
            });

            return <div key={response} className={className}>{`${response}\n`}</div>;
        })}</div>;
    };

    const COMMON_CONTENT = {
        encryption_status: boldStatusLabel,
        install_settings_dns: upstream,
        elapsed: formattedElapsedMs,
        response_code: status,
        filter,
        rule_label: rule,
        response_table_header: renderResponses(response),
        original_response: renderResponses(originalResponse),
    };

    const content = rule
        ? Object.entries(COMMON_CONTENT)
        : Object.entries({ ...COMMON_CONTENT, filter: '' });
    const detailedInfo = isBlocked ? filter : formattedElapsedMs;


    return <div className="logs__row logs__cell logs__cell--response">
        {getIconTooltip({
            className: classNames('icons mr-4 icon--24 icon--lightgray', { 'my-3': isDetailed }),
            columnClass: 'grid grid--limited',
            tooltipClass: 'px-5 pb-5 pt-4 mw-75 custom-tooltip__response-details',
            contentItemClass: 'text-truncate key-colon o-hidden',
            xlinkHref: 'question',
            title: 'response_details',
            content,
            placement: 'bottom',
        })}
        <div className="text-truncate">
            <div className="text-truncate" title={statusLabel}>{statusLabel}</div>
            {isDetailed && <div
                    className="detailed-info d-none d-sm-block pt-1 text-truncate"
                    title={detailedInfo}>{detailedInfo}</div>}
        </div>
    </div>;
};

const ClientCell = ({
    client,
    domain,
    info,
    info: { name, whois_info },
    reason,
}) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const autoClients = useSelector((state) => state.dashboard.autoClients);
    const processingRules = useSelector((state) => state.filtering.processingRules);
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);

    const autoClient = autoClients.find((autoClient) => autoClient.name === client);
    const source = autoClient?.source;
    const whoisAvailable = whois_info && Object.keys(whois_info).length > 0;

    const id = nanoid();

    const data = {
        address: client,
        name,
        country: whois_info?.country,
        city: whois_info?.city,
        network: whois_info?.orgname,
        source_label: source,
    };

    const processedData = Object.entries(data);

    const isFiltered = checkFiltered(reason);

    const nameClass = classNames('w-90 o-hidden d-flex flex-column', {
        'mt-2': isDetailed && !name && !whoisAvailable,
        'white-space--nowrap': isDetailed,
    });

    const hintClass = classNames('icons mr-4 icon--24 icon--lightgray', {
        'my-3': isDetailed,
    });

    const renderBlockingButton = (isFiltered, domain) => {
        const buttonType = isFiltered ? BLOCK_ACTIONS.UNBLOCK : BLOCK_ACTIONS.BLOCK;

        const buttonClass = classNames('logs__cell--block-button button__action', {
            'btn-outline-secondary': isFiltered,
            'btn-outline-danger': !isFiltered,
            'logs__action--detailed': isDetailed,
        });
        // todo test blocking button
        const onClick = () => dispatch(toggleBlocking(buttonType, domain));

        return <div className={buttonClass}>
            <button
                    type="button"
                    className={`btn btn-sm ${buttonClass}`}
                    onClick={onClick}
                    disabled={processingRules}
            >
                {t(buttonType)}
            </button>
        </div>;
    };

    return <div className="logs__row o-hidden h-100 logs__cell logs__cell--client">
        {getIconTooltip({
            className: hintClass,
            columnClass: 'grid grid--limited',
            tooltipClass: 'px-5 pb-5 pt-4 mw-75',
            xlinkHref: 'question',
            contentItemClass: 'text-truncate key-colon',
            title: 'client_details',
            content: processedData,
            placement: 'bottom',
        })}
        <div className={nameClass}>
            <div data-tip={true} data-for={id}>
                {formatClientCell({ value: client, original: { info } }, isDetailed)}
            </div>
            {isDetailed && name && !whoisAvailable
            && <div className="detailed-info d-none d-sm-block logs__text"
                    title={name}>
                        {name}
            </div>}
        </div>
        {renderBlockingButton(isFiltered, domain)}
    </div>;
};

const TestCell = (props) => {
    const {
        style, item, item: { reason },
    } = props;
    const isDetailed = useSelector((state) => state.queryLogs.isDetailed);

    const className = classNames('rt-tr test__separation-line px-5',
        // todo rename to e.g. status--red
        FILTERED_STATUS_TO_META_MAP?.[reason]?.color ?? QUERY_STATUS_COLORS.WHITE,
        { 'logs__cell--detailed': isDetailed });

    return <div style={style} className={className}>
        <DateCell {...item} />
        <DomainCell {...item} />
        <ResponseCell {...item} />
        <ClientCell {...item} />
    </div>;
};

export default TestCell;
