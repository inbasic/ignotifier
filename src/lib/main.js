/** Require **/
var tabs = require("sdk/tabs"),
    self = require("sdk/self"),
    timer = require("sdk/timers"),
    panel = require("sdk/panel"),
    sp = require("sdk/simple-prefs"),
    windows = require("sdk/windows").browserWindows,
    _ = require("sdk/l10n").get,
    windowutils = require("window-utils"),
    toolbarbutton = require("./toolbarbutton"),
    userstyles = require("./userstyles"),
    window = windowutils.activeBrowserWindow,
    prefs = sp.prefs,
    _prefs = require("sdk/preferences/service"),
    data = self.data,
    {
        Cc, Ci, Cu
    } = require('chrome');

/** Internal configurations **/
var config =
{
    //Gmail
    email: {
        url: "https://mail.google.com/mail/u/0",
        FEEDS: "https://mail.google.com/mail/u/0/feed/atom," + 
		"https://mail.google.com/mail/u/1/feed/atom," + 
		"https://mail.google.com/mail/u/2/feed/atom," + 
		"https://mail.google.com/mail/u/3/feed/atom",
        get feeds()
        {
            //server implementation only supports atom feeds
            var temp = (prefs.feeds.replace(/rss20/g, "atom10") || FEEDS).split(",");
            //Check Feed formats
            temp.forEach(function(feed, index)
            {
                temp[index] = feed.replace(/^\s\s*/, '').replace(/\s\s*$/, '')
            });
            return temp;
        },
        maxCount: 20
    },
    //Timing
    get period()
    {
        return (prefs.period > 10 ? prefs.period : 10)
    },
    firstTime: 1,
    desktopNotification: 3,
    //Toolbar
    get textColor()
    {
        return prefs.textColor || "#000"
    },
    get backgroundColor()
    {
        return prefs.backgroundColor || "#FFB"
    },
    toolbar: {
        id: "igmail-notifier",
        move: {
            toolbarID: "nav-bar",
            get insertbefore()
            {
                var id = _prefs.get(config.prefs + "nextSibling");
                return id ? id : "home-button"
            },
            forceMove: false
        }
    },
    defaultTooltip: _("gmail") + "\n\n" + _("tooltip1") + "\n" + _("tooltip2") + "\n" + _("tooltip3"),
    //Homepage:
    homepage: "http://add0n.com/gmail-notifier.html",
    //panel
    panel: {
        width: 410,
        height: 250,
        each: 22,
        margin: 14
    },
    //Preferences
    prefs: "extensions.jid0-GjwrPchS3Ugt7xydvqVK4DQk8Ls@jetpack."
};

/** Loading style **/
userstyles.load(data.url("overlay.css"));

/** URL parser **/

function url_parse(url)
{
    var temp = /^(http.*):\/\/w{0,3}\.*([^\#\?]*)[^\#]*#*([^\/]*)/.exec(url.replace("gmail", "mail.google"));

    return {
        protocol: temp[1] ? temp[1] : "https",
        base: temp[2] ? temp[2].replace(/\/$/, '') : config.email.url,
        label: temp[3] ? temp[3] : "inbox"
    }
}

/** convert xml to json **/

function xml2json(node)
{

    var data =
    {
    };

    // append a value

    function Add(name, value)
    {
        if (data[name])
        {
            if (data[name].constructor != Array)
            {
                data[name] = [data[name]];
            }
            data[name][data[name].length] = value;
        }
        else
        {
            data[name] = value;
        }
    };

    // element attributes
    var c, cn;
    for (c = 0; cn = node.attributes[c]; c++)
    {
        Add(cn.name, cn.value);
    }

    // child elements
    for (c = 0; cn = node.childNodes[c]; c++)
    {
        if (cn.nodeType == 1)
        {
            if (cn.childNodes.length == 1 && cn.firstChild.nodeType == 3)
            {
                // text value
                Add(cn.nodeName, cn.firstChild.nodeValue);
            }
            else
            {
                // sub-object
                Add(cn.nodeName, xml2json(cn));
            }
        }
    }

    return data;

}

/** Open new Tab or reuse old tabs to open the url **/

function open(url, inBackground)
{
    for each(var tab in windows.activeWindow.tabs)
    {
        try
        {
            var parse1 = url_parse(tab.url),
                parse2 = url_parse(url);

            if (parse1.base == parse2.base)
            {
                if (tabs.activeTab == tab)
                {
                    notify(_("gmail"), _("msg8"));
                }
                else
                {
                    tab.activate();
                }
                //change the url of the current tab
                tab.url = url;
                return;
            }
        }
        catch (e)
        {
        }
    }
    tabs.open(
    {
        url: url,
        inBackground: inBackground ? inBackground : false
    });
}

function decreaseNumOfMails(account_id, mail_id)
{

    unreadObjs[account_id].entries.splice(mail_id, 1);
    unreadObjs[account_id].count--;

    var total = 0;
    unreadObjs.forEach(function(e, i)
    {
        total += e.count;
    });

    if(total > 0)
		icon(total, "red");
    else
    	icon(total, "blue");
}


/** Multi email Panel **/
var contextPanel = panel.Panel(
{
    width: config.panel.width,
    height: config.panel.height,
    position: {
        top: 0,
        right: 30
    },
    contentURL: data.url("context.html")
});
contextPanel.port.on("open_mail", function(link)
{
    contextPanel.hide();

    if (link)
    {
        open(link);
    }
});
contextPanel.port.on("decrease_mails", function(data)
{
    //decrease the number of mails
    decreaseNumOfMails(data.account_id, data.mail_id);
});


/** onCommand **/
var onCommand = function(e, tbb, link)
{
    if (!unreadObjs.length)
    {
        open(config.email.url);
    }
    else if (link)
    {
        open(link);
    }
    else
    {
        contextPanel.port.emit('list', unreadObjs);
        try
        {
            contextPanel.show(tbb);
        }
        catch (e)
        {
            contextPanel.show(null, tbb);
        }
    }
}

/** Toolbar button **/
gButton = toolbarbutton.ToolbarButton(
{
    id: config.toolbar.id,
    label: _("gmail"),
    tooltiptext: config.defaultTooltip,
    backgroundColor: config.backgroundColor,
    textColor: config.textColor,
    onClick: function(e)
    { //Linux problem for onClick
        if (e.button == 1 || (e.button == 0 && e.ctrlKey))
        {
            e.preventDefault();
            e.stopPropagation();
            tm.reset(true);
        }
    },
    onContext: (function()
    {
        var installed = false;
        return function(e, menupopup, _menuitem)
        {
            //Install command event listener
            if (!installed)
            {
                menupopup.addEventListener("command", function(e)
                {
                    var link = e.originalTarget.value;
                    if (link) open(link.replace(/\?.*/, ""));
                });
                installed = true;
            }
            //In case where user also listening on different labels than inbox, there would be duplicated elements
            var temp = (function(arr)
            {
                arr.forEach(function(item, index)
                {
                    for (var i = index + 1; i < arr.length; i++)
                    {
                        if (arr[i] && item.label == arr[i].label)
                        {
                            delete arr[index]
                        }
                    }
                });
                return arr.filter(function(item)
                {
                    return item
                });
            })(loggedins);
            //remove old items
            while (menupopup.firstChild)
            {
                menupopup.removeChild(menupopup.firstChild)
            }

            function addChild(label, value)
            {
                var item = _menuitem.cloneNode(true);
                item.setAttribute("label", label);
                item.setAttribute("value", value);
                menupopup.appendChild(item);
            }
            if (temp.length)
            {
                temp.forEach(function(obj)
                {
                    addChild(obj.label, obj.link);
                });
            }
            else
            {
                addChild(_("context"), "");
            }
        }
    })(),
    onCommand: onCommand
});

/** icon designer**/
var icon = function(number, clr)
{
    gButton.loadMode = false;
    gButton.badge = (number < 10) ? number : "+";
    gButton.color = clr;
}

icon(null, "gray");

/** Initialize **/
var OS, tm, gButton, unreadObjs = [],
    loggedins = [];
exports.main = function(options, callbacks)
{
    //OS detection, required by sound
    var runtime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
    OS = runtime.OS;
    //Timer
    tm = manager(config.firstTime * 1000, checkAllMails);
    //Install
    if (options.loadReason == "install" || prefs.forceVisible)
    {
        //If adjacent button is restartless wait for its creation
        timer.setTimeout(function()
        {
            gButton.moveTo(config.toolbar.move);
        }, 800);
    }
    //Welcome page
    if (options.loadReason == "upgrade" || options.loadReason == "install")
    {
        welcome();
    }
};

/** Store toolbar button position **/
var aWindow = windowutils.activeBrowserWindow;
var aftercustomizationListener = function()
{
    let button = aWindow.document.getElementById(config.toolbar.id);
    if (!button) return;
    _prefs.set(config.prefs + "nextSibling", button.nextSibling.id);
}
aWindow.addEventListener("aftercustomization", aftercustomizationListener, false);
exports.onUnload = function(reason)
{
    aWindow.removeEventListener("aftercustomization", aftercustomizationListener, false);
}

/** Prefs Listener**/
sp.on("textColor", function()
{
    gButton.textColor = config.textColor;
});
sp.on("backgroundColor", function()
{
    gButton.backgroundColor = config.backgroundColor;
});
sp.on("clrPattern", function()
{
    tm.reset();
});

/** Interval manager **/
var manager = function(once, func)
{
	var _timer, first = true;

	function run(t1, param)
	{
		_timer = timer.setTimeout(function()
		{
			func(first ? param : null);
			first = false;
			run(t1);
		}, first ? t1 : config.period * 1000);
	}
	run(once);

	return {
		reset: function(forced)
		{
			timer.clearTimeout(_timer);
			first = true;
			run(0, forced);
		}
	}
};

/** User's actions **/
/*tabs.on('ready', function(tab)
{
	if (/mail\.google\.com/.test(tab.url))
	{
		tm.reset();
	}
});*/ 

/** Welcome page **/
var welcome = function()
{
	timer.setTimeout(function()
	{
		open(config.homepage);
	}, 3000);
}

/** Server **/
var server =
{
	parse: function(req, feed)
	{
		var xml;
		if (req.responseXML)
		{
			xml = req.responseXML;
		}
		else
		{
			if (!req.responseText) return;

			var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
			xml = parser.parseFromString(req.responseText, "text/xml");
		}
		return {
			get fullcount()
			{
				var temp = 0;
				try
				{
					var tags = xml.getElementsByTagName("fullcount");
					if (tags.length)
					{
						temp = parseInt(tags[0].childNodes[0].nodeValue);
					}
					else
					{ //atom does not provide fullcount attribute
						temp = xml.getElementsByTagName("entry").length;
					}
				}
				catch (e)
				{
				}
				return temp;
			}, get title()
			{
				var temp = "";
				try
				{
					temp = xml.getElementsByTagName("title")[0].childNodes[0].nodeValue;
					temp = temp.match(/[^ ]+@.+\.[^ ]+/)[0];
				}
				catch (e)
				{
				}
				return temp;
			}, get label()
			{
				var label = "";
				try
				{
					var tagline = xml.getElementsByTagName("tagline")[0].childNodes[0].nodeValue;
					if (tagline)
					{
						var match = tagline.match(/\'(.*)\' label/);
						if (match.length == 2)
						{
							label = match[1];
						}
					}
				}
				catch (e)
				{
				}
				return label;
			}, get link()
			{
				var temp = config.email.url,
					label;
				try
				{
					//Inbox href
					label = this.label;
					var id = /u\/\d/.exec(feed); //Sometimes id is wrong in the feed structure!
					temp = xml.getElementsByTagName("link")[0].getAttribute("href");
					if (id.length)
					{
						temp = temp.replace(/u\/\d/, id[0]);
					};
					if (label)
					{
						temp += "/?shva=1#label/" + label;
					}
				}
				catch (e)
				{
				}
				return temp;
			}, get authorized()
			{
				var temp = "";
				try
				{
					temp = xml.getElementsByTagName("TITLE")[0].childNodes[0].nodeValue;
				}
				catch (e)
				{
				}
				return temp;
			}, get entries()
			{
				var temp = Array.prototype.slice.call(xml.getElementsByTagName("entry"));
				var ret = new Array();
								
				try
				{
					temp.forEach(function(node, i){
						ret.push(xml2json(node));	
					});
				}
				catch (e)
				{
				}												
				return ret;
			}
		}
	},
/* check gmail
   * feed: feed url
   * callback: callback function [xml, count, color, [title, text]]
   * pointer: callback this pointer
   */
	mCheck: function(feed, callback, pointer)
	{
		var state = false,
			msgs = [],
			oldCount = 0; //For more than 20 unreads
/*
     * forced: is this a forced check?
     * isRecent: did user recently receive a notification?
     */
		return function(forced, isRecent)
		{
			//Check state
			if (state && !forced)
			{
				return;
			}
			//Initialazing
			state = true;

			var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
			req.mozBackgroundRequest = true; //No authentication
			req.open('GET', feed, true);
			req.onreadystatechange = function()
			{
				if (req.readyState != 4) return;
				var response = new server.parse(req, feed);

				var count = 0;
				var normal = false; //not logged-in but normal response from gmail
				var newUnread = false;
				var exist = req.status == 200; //Gmail account is loged-in
				if (exist)
				{
					count = response.fullcount;
					if (oldCount > config.email.maxCount || count > config.email.maxCount)
					{
						newUnread = (count > oldCount)
					}
					else
					{
						response.entries.forEach(function(entry, i)
						{
							var id = entry.id;
							if (msgs.indexOf(id) == -1)
							{
								newUnread = true;
							}
						});
					}
					oldCount = count;
					msgs = [];
					response.entries.forEach(function(entry, i)
					{
						msgs.push(entry.id);
					});
				}
				else
				{
					msgs = [];
					oldCount = 0;
				}

				if (!exist && req.responseText && response.authorized == "Unauthorized")
				{
					normal = true;
				}
				state = false;

				//Gmail logged-in && has count && new count && forced				
				if (exist && count && newUnread && forced)
				{ /* xml, count, showAlert, color, message */
					if (callback) callback.apply(pointer, [response, count, true, "red", [response.title, count]])
					return;
				}
				//Gmail logged-in && has count && new count && no force
				if (exist && count && newUnread && !forced)
				{
					if (callback) callback.apply(pointer, [response, count, true, "red", [response.title, count]])
					return;
				}
				//Gmail logged-in && has count && old count && forced
				if (exist && count && !newUnread && forced)
				{
					if (callback) callback.apply(pointer, [response, count, true, "red", [response.title, count]])
					return;
				}
				//Gmail logged-in && has count && old count && no forces
				if (exist && count && !newUnread && !forced)
				{
					if (callback) callback.apply(pointer, [response, count, false, "red", [response.title, count]])
					return;
				}
				//Gmail logged-in && has no-count && new count && forced
				if (exist && !count && newUnread && forced)
				{
					if (callback) callback.apply(pointer, [response, 0, false, "blue"])
					return;
				}
				//Gmail logged-in && has no-count && new count && no force
				if (exist && !count && !newUnread && !forced)
				{
					if (callback) callback.apply(pointer, [response, 0, false, "blue"])
					return;
				}
				//Gmail logged-in && has no-count && old count && forced
				if (exist && !count && !newUnread && forced)
				{
					if (callback) callback.apply(pointer, [response, 0, false, "blue"])
					return;
				}
				//Gmail logged-in && has no-count && old count && no forced
				if (exist && !count && !newUnread && !forced)
				{
					if (callback) callback.apply(pointer, [response, 0, false, "blue"])
					return;
				}
				//Gmail not logged-in && no error && forced
				if (!exist && normal && forced)
				{
					if (!isRecent) open(config.email.url);

					if (callback) callback.apply(pointer, [response, null, false, "unknown",
						            isRecent ? null : ["", _("msg1")]]);
					return;
				}
				//Gmail not logged-in && no error && no force
				if (!exist && normal && !forced)
				{
					if (callback) callback.apply(pointer, [response, null, false, "unknown"])
					return;
				}
				//Gmail not logged-in && error && forced
				if (!exist && !normal && forced)
				{
					if (callback) callback.apply(pointer, [response, null, false, "unknown",
                                                          isRecent ? null : [_("error") + ": ", _("msg2")]]);
                    return;
                }
                //Gmail not logged-in && error && no force
                if (!exist && !normal && !forced)
                {
					if (callback) callback.apply(pointer, [response, null, false, "unknown"])
                    return;
                }
            }
            // https://github.com/inbasic/ignotifier/issues/29
            req.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = true;
            req.send(null);
        }
    }
}

/** checkAllMails **/
var checkAllMails = (function()
{
    var len = config.email.feeds.length,
        pushCount, isForced, results = [],
        gClients = [];
    config.email.feeds.forEach(function(feed, index)
    {
        gClients[index] = new server.mCheck(feed, step1);
    });

	function step1(response, count, alert, color, msgObj)
    {
        results.push(
        {
			response: response,
            count: count,
            alert: alert,
            color: color,
            msgObj: msgObj
        });

        pushCount -= 1;
        if (!pushCount) step2();
    }

    function step2()
    {
        //clear old feeds
        unreadObjs = [];
        loggedins = [];
        //Notifications
        var text = "",
            tooltiptext = "",
            total = 0;
        var showAlert = false;
        //Sort accounts
        results.sort(function(a, b)
        {
            var var1, var2;
            if (prefs.alphabetic)
            {
				var1 = a.response.title;
				var2 = b.response.title;
            }
            else
            {
				var1 = a.response.link;
				var2 = b.response.link;
            }

            if (var1 > var2) return 1;
            if (var1 < var2) return -1;
            return 0;
        });
        //Execute
        var singleLink = null;
        results.forEach(function(r, i)
        {
            //
            if (r.msgObj)
            {
                if (typeof(r.msgObj[1]) == "number")
                {
					var label = r.response.label;
                    var msg = r.msgObj[0] + (label ? "/" + label : "") + " (" + r.msgObj[1] + ")";
                    if (r.alert)
                    {
						text += (text ? "\n" : "") + msg;
                        if (singleLink === null)
                        {
							singleLink = r.response.link;
                        }
                        else
                        {
                            singleLink = "";
                        }
                    }
                    tooltiptext += (tooltiptext ? "\n" : "") + msg;
                    total += r.msgObj[1];
                    unreadObjs.push(
                    {
						link: r.response.link,
                        count: r.msgObj[1],
						account: r.msgObj[0],
						entries: r.response.entries
                    });
                }
                else
                {
					text += (text ? "\n" : "") + r.msgObj[0] + " " + r.msgObj[1];
                }
            }
            showAlert = showAlert || r.alert;
            //Menuitems
            if (r.count !== null)
            {
                loggedins.push(
                {
					label: r.response.title,
					link: r.response.link
                });
            }
        });
		
        if (prefs.notification && (isForced || showAlert) && text)
        {
            notify(_("gmail"), text, singleLink ? true : false, singleLink);
        }

        if (prefs.alert && (showAlert) && text)
        {
            play();
        }
        //Tooltiptext
        gButton.tooltiptext = tooltiptext ? tooltiptext : config.defaultTooltip;
        //Icon
        var isRed = false,
            isBlue = false;
        results.forEach(function(r, i)
        {
            if (r.color == "red") isRed = true;
            if (r.color == "blue") isBlue = true;
        });

        if (isRed) icon(total, "red");
        else if (isBlue) icon(null, "blue");
        if (!isRed && !isBlue) icon(null, "gray");
    }

    return function(forced)
    {
        if (forced) gButton.loadMode = true;

        pushCount = len;
        results = [];
        isForced = forced;
        gClients.forEach(function(gClient, index)
        {
            gClient(forced, index ? true : false)
        });
    }
})();

/** Prefs **/
sp.on("reset", function()
{
    if (!window.confirm(_("msg7"))) return
    prefs.backgroundColor = "#FFB";
    prefs.textColor = "#000";
    prefs.alphabetic = false;
    prefs.alert = true;
    prefs.notification = true;
    prefs.period = 15;
    prefs.feeds = config.email.FEEDS;
    prefs.soundNotification = 1;
});

/** Notifier **/
var notify = (function()
{ // https://github.com/fwenzel/copy-shorturl/blob/master/lib/simple-notify.js
    return function(title, text, clickable, link)
    {
        try
        {
            let alertServ = Cc["@mozilla.org/alerts-service;1"].
            getService(Ci.nsIAlertsService);
            //In linux config.image does not work properly!
            alertServ.showAlertNotification(data.url("notification.png"), title, text, clickable, link, function(subject, topic, data)
            {
                if (topic == "alertclickcallback")
                {
                    onCommand(null, null, link);
                }
            }, "");
        }
        catch (e)
        {
            let browser = windowutils.activeBrowserWindow.gBrowser, notificationBox = browser.getNotificationBox();

            notification = notificationBox.appendNotification(text, 'jetpack-notification-box', data.url("notification.png"), notificationBox.PRIORITY_INFO_MEDIUM, []);
            timer.setTimeout(function()
            {
                notification.close();
            }, config.desktopNotification * 1000);
        }
    }
})();

/** Player **/
var play = function()
{
    let sound = Cc["@mozilla.org/sound;1"].createInstance(Ci.nsISound);
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    switch (prefs.soundNotification)
    {
    case 0:
        sound.playEventSound(OS == "Linux" ? 1 : 0);
        break;
    case 1:
        sound.play(ios.newURI(data.url("alert.wav"), null, null));
        break;
    case 2:
        try
        {
            let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
            file.initWithPath(prefs.sound);
            sound.play(ios.newFileURI(file));
        }
        catch (e)
        {
            timer.setTimeout(function()
            {
                notify(_("gmail"), _("msg9"));
            }, 500);
        }
    }
}