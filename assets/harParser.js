'use strict';

function harParser( har ) {
    har = har.log;

    var
        verticalRowMarker = function( cname, title, value, left ) {
            var result = '<span class="' + cname + '" data-toggle="tooltip" ';

            result += 'title="[' + title + '] (' + harParser.timeFormatter( value ) + ')" ';
            result += 'style="left:' + ( parseFloat( left ) > 100 ? '100%' : left ) + '"></span>';

            return result;
        },

        sortEntries = function( a, b ) {
            a = a.startedDateTime;
            b = b.startedDateTime;

            if( a ) {
                a = ( new Date( a ) ).getTime();
            } else {
                a = 0;
            }

            if( b ) {
                b = ( new Date( b ) ).getTime();
            } else {
                b = 0;
            }
            return a - b;

        },

        filterEntryByPage = function( entries, id ) {
            var newEntries = null, i = null, ilen = 0, entry = null;
            if( id && id !== '' ) {
                newEntries = [];
                for( i = 0, ilen = entries.length; i < ilen; i++ ) {
                    entry = entries[i];
                    if( entry.pageref && entry.pageref === id ) {
                        newEntries.push( entry );
                    }
                }
                return newEntries;
            }
            return entries;
        },

        verticalMarkers = function( entries, params ) {
            var i = 0,
                j = 0,
                ilen = entries.length,
                args = [
                    {
                        cname: 'windowloaded',
                        title: 'Page Loaded',
                        value: 'onLoad',
                        param1: 'onLoad',
                        param2: 'lastTime',
                        left: false,
                        verify: true
                    },
                    {
                        cname: 'domloaded',
                        title: 'DOMContentLoaded',
                        value: 'load',
                        left: 'loadText',
                        verify: params.load
                    },
                    {
                        cname: 'renderstarted',
                        title: 'Start Render',
                        value: 'start',
                        param1: 'start',
                        param2: 'lastTime',
                        left: false,
                        verify: params.start
                    }
                ],
                jlen = args.length;

            for( ;i < ilen; i++ ) {
                for( j = 0; j < jlen; j++ ) {
                    if( args[j].verify ) {
                        entries[i][args[j].cname] = verticalRowMarker(
                            args[j].cname,
                            args[j].title,
                            params[args[j].value],
                            params[args[j].left] ||
                                harParser.pct( params[args[j].param1], params[args[j].param2] )
                        );
                    } else {
                        entries[i][args[j].cname] = '';
                    }
                }
            }

            return entries;
        },
        parsePages = function( pages ) {
            var hars = har.pages.filter( function( page ) { return!!page.id; });

            if( !hars.length ) {
                hars = [ pages.pages[0] ];
            }

            hars = hars.map( function( page ) {
                var entries = filterEntryByPage( pages.entries, page.id ),
                    pageTimings = page.pageTimings,
                    onContentLoad = pageTimings.onContentLoad || false,
                    onLoad = pageTimings.onLoad,
                    totalSize = 0,
                    totalCompressedSize = 0,
                    lastTimeArray = [ onLoad ],
                    i = 0,
                    ilen = entries.length,
                    progress = [],
                    prop = null, lastTime = null, hResponse = null,
                    hProgress = null, hEntry = null;

                entries.sort( sortEntries );

                for( ;i < ilen; i++ ) {
                    hEntry = entries[i];
                    hResponse = hEntry.response;


                    if( hResponse.content ) {
                        totalSize += hResponse.content.size;
                    }
                    totalCompressedSize += hResponse.bodySize;

                    hProgress = harParser.parseProgress( hEntry );
                    progress.push( hProgress );


                    hEntry = entries[i] = harParser.convertHar( hEntry, i );

                    lastTimeArray.push(
                    ( hProgress.total + hProgress.startedDateTime ) - progress[0].startedDateTime
                );
                }


                lastTime = Math.max.apply( null, lastTimeArray );

                if( ilen > 0 ) {
                    progress = harParser.convertProgress( progress, lastTime );
                }
                for( i = 0; i < ilen; i++ ) {
                    hProgress = progress[i];
                    for( prop in hProgress ) {
                        entries[i][prop] = hProgress[prop];
                    }
                }

                entries = verticalMarkers( entries, {
                    onLoad: onLoad,
                    lastTime: lastTime,
                    load: onContentLoad,
                    loadText: onContentLoad ? harParser.pct( onContentLoad, lastTime ) : '',
                    start: pageTimings._startRender || false
                });

                entries.title = page.title;
                entries.pRef = page.id;

                onContentLoad = harParser.timeFormatter( onContentLoad || 0 );

                entries.size = {
                    total: harParser.dataSizeFormatter( totalSize ),
                    compressed: harParser.dataSizeFormatter( totalCompressedSize )
                };

                entries.load = {
                    content: onContentLoad,
                    on: harParser.timeFormatter( onLoad )
                };

                return entries;
            });

            return hars;

        };

    return parsePages( har );


}
//Decode url texts
harParser.decode = function( str ) {
    var _str = null;
    try {
        _str = decodeURIComponent( str );
    } catch( e ) {
        try {
            _str = decodeURI( str );
        } catch( ee ) {
            try {
                _str = unescape( str );
            } catch( eee ) {
                _str = str;
            }
        }
    }
    return _str;
};
//Return request method with strong tag, or empty if GET
harParser.parseMethod = function( method ) {
    return method && method + ' ' || '';
};

harParser.urlRe = /([^:]+:\/+)([^\/]*)(\/?(?:\/?([^\/\?\#]*))*)(.*)/i;
harParser.urlDataRe = /^data:(\w+\/\w+);(?:base64,)?(charset=[^,]+,)?(.+)$/i;

//Parse url and return an object with necessary attributes
harParser.parseUrl = function( url, complete ) {
    var urlMatch = url.match( harParser.urlRe ),
        urlFile = '',
        urlPath = '';

    if( !urlMatch ) {
        if( !url.indexOf( 'data:' ) ) {
            urlFile = 'Data:';
        } else {
            urlFile = url;
        }
    } else {
        if( !urlMatch[4] ) {
            urlFile = urlMatch[3];

            if( complete ) {
                urlFile = urlMatch[1] + urlMatch[2] + urlFile;
            } else if( !urlFile ) {
                urlFile = '/';
            }
        } else {
            urlFile = urlMatch[4];
        }
        urlPath = String( urlMatch[3].match( /.*\// ) ) || '/';
    }

    urlFile = urlFile.replace( /^\s*/g, '' ).replace( /\s*$/g, '' );
    urlPath = urlPath.replace( /^\s*/g, '' ).replace( /\s*$/g, '' );

    return{
        params: harParser.decode( urlMatch && urlMatch[5] || '' ),
        file: urlFile,
        path: urlPath,
        complete: url
    };
};
//Parse status + statusText and return an object with necessary attributes
harParser.parseStatus = function( code, statusText ) {
    var status = code;

    statusText = statusText || '';

    return{
        code: code,
        status: status,
        complete: code + ( statusText ? ( ' ' + statusText ) : '' )
    };

};
//Return object with original and compressed size formatted and without format
harParser.parseSize = function( size, compressed ) {
    var mainSize = compressed;

    if( compressed < 0 ) {
        mainSize = 0;
    } else if( compressed === 0 ) {
        mainSize = size;
    }

    mainSize = harParser.dataSizeFormatter( mainSize );

    return{
        originalSize: size + ' Bytes',
        originalCompressed: compressed + ' Bytes',
        size: mainSize,
        complete: size,
        compressed: compressed
    };
};

//Return object with separated mime type informations
harParser.parseMime = function( mimeType, url ) {
    var inline = false,
        mime = null;

    if( !mimeType && url && !url.indexOf( 'data:' ) ) {
        mimeType = url.match( harParser.urlDataRe );

        if( mimeType && mimeType[1] ) {
            mimeType = mimeType[1] + '; ';
            mimeType += ( mimeType[2] && mimeType[2].substr( 0, mimeType[2].length - 1 ) || '' );
        } else {
            mimeType = false;
        }

        inline = true;
    }


    if( mimeType ) {
        mime = mimeType.split( ';' )[0].split( '/' );

        return{
            complete: mimeType.replace( '; ', '' ),
            type: mime[1],
            base: mime[0],
            inline: inline
        };
    } else {
        return{
            complete: '',
            type: '',
            base: '',
            inline: inline
        };
    }
};
//Return object with progress informations
harParser.parseProgress = function( entry ) {
    var timings = entry.timings,
        blocked = timings.blocked,
        dns = timings.dns,
        connect = timings.connect,
        send = timings.send,
        wait = timings.wait,
        receive = timings.receive,
        ssl = timings.ssl,
        _blocked = blocked >= 0 ? blocked : 0,
        _dns = dns >= 0 ? dns : 0,
        _connect = connect >= 0 ? connect : 0,
        _send = send >= 0 ? send : 0,
        _wait = wait >= 0 ? wait : 0,
        _receive = receive >= 0 ? receive : 0,
        _ssl = ssl >= 0 ? ssl : 0;



    return{
        startedDateTime: ( new Date( entry.startedDateTime ) ).getTime(),
        time: entry.time,
        blocked: blocked,
        dns: dns,
        connect: connect,
        send: send,
        wait: wait,
        receive: receive,
        ssl: ssl,
        total:	_blocked +
            _dns +
            _connect +
            _send +
            _wait +
            _receive +
            _ssl
    };
};
//Format size to show
harParser.dataSizeFormatter = function( value, precision ) {
    var ext = [ ' Bytes', ' KB', ' MB', ' GB', ' TB' ],
        i = 0;

    value = value >= 0 ? value : 0;

    while( value > 1024 && i < ( ext.length - 1 ) ) {
        value /= 1024;
        i++;
    }

    return harParser.precisionFormatter( value, precision || 2 ) + ext[i];
};
//Format float point precision
harParser.precisionFormatter = function( number, precision ) {
    var matcher = null, fPoint = null;
    precision = precision || 2;


    number = number.toFixed( precision );

    if( precision === '0' ) {
        return number;
    }

    fPoint = number.split( '.' )[1];

    matcher = fPoint.match( /0+/ );

    if( matcher && matcher[0].length === fPoint.length ) {
        return number.split( '.' )[0];
    } else {
        return number;
    }
};
//Calculate pct value
harParser.pct = function( value, pct, symbol ) {
    if( !value ) {
        return 0;
    }
    symbol = symbol || '%';
    return( ( value * 100 ) / pct ) + symbol;
};
//Format time based on miliseconds
harParser.timeFormatter = function( time, precision ) {
    var ext = [ 'ms', 's', 'min', 'h' ],
        div = [ 1000, 60, 60, 60 ],
        i = 0;

    time = time >= 0 ? time : 0;

    while( time >= div[i] && i < ( ext.length - 1 ) ) {
        time /= div[i];
        i++;
    }

    return harParser.precisionFormatter( time, precision || 2 ) + ext[i];
};
//Decode multiple encoded text
harParser.decoder = function( text ) {
    var oldtext = '';

    do{
        oldtext = text;
        text = harParser.decode( text );
    } while( text !== oldtext );

    return text;
};
//Decode a list of objects
harParser.decodeObj = function( objList ) {
    var newObjList = [],
        i = 0,
        ilen = 0, obj = null;

    if( !objList || !objList.length ) {
        return objList;
    }

    for( ilen = objList.length; i < ilen; i++ ) {
        obj = objList[i];
        newObjList.push({
            name: obj.name,
            value: harParser.decoder( obj.value )
        });
    }

    return newObjList;

};
//Filter an attribute value in an object list
harParser.filterObjList = function( objList, attr, filter ) {
    var newObjList = [],
        i = 0,
        ilen  = 0,
        obj = null;

    if( !filter ) {
        return objList;
    }

    filter = filter.toLowerCase();

    for( ilen = objList.length; i < ilen; i++ ) {
        obj = objList[i];
        if( !obj.hasOwnProperty( attr ) || obj[attr].toLowerCase().indexOf( filter ) === -1 ) {
            newObjList.push( obj );
        }
    }

    return newObjList;
};

// Convert progress data to an object with converted data and HTML to tooltip
harParser.convertProgress = function( progress, lastTime ) {
    var firstTime = progress[0].startedDateTime,
        i = 0,
        ilen = progress.length,
        result = [],
        progressContent = '', startedTime = null, r = null,
        steps = [
            { classname: 'warning', title: 'Blocking', step: 'blocked' },
            { classname: 'last', title: 'DNS', step: 'dns' },
            { classname: 'info', title: 'Connect', step: 'connect' },
            { classname: 'secondary', title: 'SSL', step: 'ssl' },
            { classname: 'primary', title: 'Send', step: 'send' },
            { classname: 'danger', title: 'Wait', step: 'wait' },
            { classname: 'success', title: 'Receive', step: 'receive' }
        ],
        step = 0, j = 0, jlen = steps.length, p = 0;

    for( ;i < ilen; i++ ) {
        r = {};
        p = progress[i];
        startedTime = p.startedDateTime - firstTime;

        for( j = 0; j < jlen; j++ ) {
            step = steps[j];

            if( p[step.step] >= 0 ) {
                r[step.step + 'Width'] = harParser.pct( p[step.step], lastTime );
                r[step.step + 'LocalWidth' ] = harParser.pct( p[step.step], p.total );
                r[step.step + 'Time'] = harParser.timeFormatter( p[step.step] );
            } else {
                r[step.step + 'Width'] = '0';
                r[step.step + 'LocalWidth'] = '0';
                r[step.step + 'Time'] = harParser.timeFormatter( 0 );
            }
        }


        if( startedTime >= 0 ) {
            r.progressStart = startedTime;
        } else {
            r.progressStart = '';
        }

        r.startPosition = harParser.pct( startedTime, lastTime );
        r.totalTime = harParser.timeFormatter( p.total );

        result.push( r );
    }

    return result;

};
// Convert a request into another object
harParser.convertHar = function( entry, i ) {
    var __request = entry.request,
        __response = entry.response,

        method = harParser.parseMethod( __request.method ),
        url = harParser.parseUrl( __request.url, i > 1 ),
        status = harParser.parseStatus( __response.status, __response.statusText ),
        size = harParser.parseSize( __response.content && __response.content.size || -1,
                                    __response.bodySize, status.code ),
        mime = harParser.parseMime( __response.content && __response.content.mimeType || '',
                                    url.complete ),
        responseContent = __response.content && __response.content.text || undefined,
        requestCookies = __request.cookies || [],
        responseCookies = __response.cookies || [];

    return{
        method: method,
        fullUrl: url.complete,
        fileName: url.file,
        path: url.path,
        params: url.params,
        status: status.status,
        fullStatus: status.complete,
        serverIPAddress: entry.serverIPAddress,
        mime: ( mime.type === 'plain' || !mime.type ) && mime.base ? mime.base : mime.type,
        fullMimeType: mime.complete,
        size: size.originalCompressed,
        fullSize: size.originalSize,
        sizeToShow: size.size,
        request: entry.request,
        response: entry.response,
        fileContent: responseContent,
        requestCookies: requestCookies,
        responseCookies: responseCookies
    };

};
