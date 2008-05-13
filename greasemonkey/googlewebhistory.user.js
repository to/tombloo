// ==UserScript==
// @name           GoogleWebHistory
// @namespace      http://userscripts.org/users/7010
// @include        *
// ==/UserScript==

if(window.parent == window)
	GM_Tombloo.GoogleWebHistory.post(location.href);
