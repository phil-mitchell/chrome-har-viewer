'use strict';

/* global Handlebars,harParser */

function allTextNodes( nodes ) {
    return Object.keys( nodes ).reduce( function( result, key ) {
        return result && nodes[key].nodeName === '#text';
    }, true );
}

function getPreWithSource() {
    var childNodes = document.body.childNodes;

    if( childNodes.length > 1 && allTextNodes( childNodes ) ) {
        document.body.normalize(); // concatenates adjacent text nodes
    }

    if( childNodes.length === 1 ) {
        var childNode = childNodes[0];
        var nodeName = childNode.nodeName;
        var textContent = childNode.textContent;

        if( nodeName === 'PRE' ) {
            return childNode;

            // if Content-Type is text/html
        } else if( nodeName === '#text' && textContent.trim().length > 0 ) {
            var pre = document.createElement( 'pre' );
            pre.textContent = textContent;
            document.body.removeChild( childNode );
            document.body.appendChild( pre );
            return pre;
        }
    }

    return null;
}

Handlebars.registerHelper( 'trimPath', function( path ) {
    if( path.length <= 63 ) {
        return path;
    }

    return new Handlebars.SafeString( '...' + path.substring( path.length - 60 ) );
});

Handlebars.registerHelper( 'inc', function( n ) {
    return n + 1;
});

function onLoad() {
    var content = getPreWithSource();
    var toggle = `
function toggleDisplay( id, display ) {
    var el = document.getElementById( id );
    if( el ) {
        el.style.display = el.style.display === 'none' ? display : 'none';
    }
}

function toggleExpander( id ) {
    var el = document.getElementById( id );
    if( el ) {
        el.innerText = el.innerText === 'expand_more' ? 'expand_less' : 'expand_more';
    }
}
`;
    var script = document.createElement( 'script' );
    script.textContent = toggle;
    ( document.head || document.documentElement ).appendChild( script );
    script.remove();

    try {
        var har = harParser( JSON.parse( content.textContent ) );
        var html = Handlebars.templates.pages({ pages: har });
        document.body.innerHTML = html;
    } catch( e ) {
        console.log( e );
    }


}

document.addEventListener( 'DOMContentLoaded', onLoad, false );
