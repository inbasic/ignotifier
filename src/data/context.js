HTMLCollection.prototype.forEach = Array.prototype.forEach

var accounts = [];
var cur_account = 0;
var width;

addon.port.on("command", function (arg) {
	initLists(arg);
});

function initLists(list)
{
	var cur_account = -1;
	width = document.getElementById("content_mask").offsetWidth;
	
	accounts = list;
	cleanUI();
	
	var selectors = '';
	
	list.forEach(function(e,i){
		accounts[i].current = 0;
		
		if(cur_account==-1 && e.count>0)
		{
			cur_account = i;
		}
		
	 	selectors += '<li><a onclick="changeAccount(this, '+i+');">'+e.account+'</a></li>'; 
		
		addEmailContent(e);
	});
	
	if(cur_account != -1)
	{
		//Add all the selectors
		document.getElementById("accounts").innerHTML = document.getElementById("accounts").innerHTML + selectors;
		
		//change to the account with some mails 
		document.getElementById("accounts").children[cur_account].children[0].onclick();
		
		//align rtl emails
		document.getElementById("content_mask").children.forEach(function(ul){
			ul.children.forEach(function(li){
				var dir = window.getComputedStyle(li, null).direction;
				
				if(dir == "rtl")
					li.classList.add(dir);
					
				li.addEventListener('transitionend', function(e){if (e.propertyName == 'top') ul.removeChild(li);}, false);
			});
			
		});
		
		
	}	
}

function addEmailContent(entry)
{
	//add the container
	var elm = '<ul class="content" style="width: '+(width*entry.count)+'px;">';
	
	entry.entries.forEach(function(e, i){
		elm += '<li dir="auto">'+
				'<h1>'+((e.title != "")? e.title: "(no subject)")+'</h1>'+
				'<div class="sender"><a href="https://mail.google.com/mail/?view=cm&fs=1&tf=1&to='+e.author_email+'" onclick="return openTab(this.href);">'+e.author_name+'</a> <span>&lt;'+e.author_email+'&gt;</span></div>'+
				'<div class="date">'+prettyDate(e.issued)+'</div>'+
				'<p>'+((e.summary != "")? e.summary: "(no content)")+'</p>'+
				'</li>';
	});
	
	elm += '</ul>';	
	
	document.getElementById("content_mask").innerHTML = document.getElementById("content_mask").innerHTML + elm;
}


function cleanUI()
{
	clear("accounts");
	clear("content_mask");
	clear("nav_text");
	clear("account_selector");
}

function clear(obj)
{
	obj = document.getElementById(obj);
	while (obj.firstChild)
	{
		obj.removeChild(obj.firstChild);
	}
}


function changeAccount(obj, account_id)
{
	//remove the selected
	document.getElementById("accounts").children[cur_account].classList.remove("selected");
	
	//hide others contents
	document.getElementById("content_mask").children.forEach(function(e, i){
		e.style.display = 'none';	
	});
	document.getElementById("content_mask").children[account_id].style.display = 'block';

	obj.parentNode.classList.add("selected");
	document.getElementById("account_selector").innerHTML = obj.innerHTML;
	
	cur_account = account_id;
	
	initNav();
	
}

function initNav()
{
	var account = accounts[cur_account];
	 
	document.getElementById("nav_text").innerHTML = '<span>'+(Math.min(account.current+1,account.count))+'</span> of '+account.count;
	
	//init nav buttons
	if((account.current)>0)
		document.getElementById("nav").getElementsByClassName("prev")[0].classList.remove("disabled");
	else
		document.getElementById("nav").getElementsByClassName("prev")[0].classList.add("disabled");
			
	if((account.current+1) < account.count)
		document.getElementById("nav").getElementsByClassName("next")[0].classList.remove("disabled");
	else
		document.getElementById("nav").getElementsByClassName("next")[0].classList.add("disabled");
}

function showNext()
{
	var current = accounts[cur_account].current;
	var total = accounts[cur_account].count;
	var ul = document.getElementById("content_mask").children[cur_account];

	if ((current+1) < total)
	{
		current++;
		ul.style.left = '-' + width * current + 'px';
		document.getElementById("nav_text").children[0].innerHTML = current+1;
		
		accounts[cur_account].current = current;
	}
	
	if ((current+1) < total) 
		document.getElementById("nav").getElementsByClassName("next")[0].classList.remove("disabled");
	else
		document.getElementById("nav").getElementsByClassName("next")[0].classList.add("disabled");
	
	if (current > 0) 
		document.getElementById("nav").getElementsByClassName("prev")[0].classList.remove("disabled");
}

function showPrev()
{
	var current = accounts[cur_account].current;
	var total = accounts[cur_account].count;
	var ul = document.getElementById("content_mask").children[cur_account];
	
	if (current > 0)
	{
		ul.style.left = '-' + width * (current-1) + 'px';
		document.getElementById("nav_text").children[0].innerHTML = (current);
		
		accounts[cur_account].current = --current;
	}

	if (current > 0) 
		document.getElementById("nav").getElementsByClassName("prev")[0].classList.remove("disabled");
	else
		document.getElementById("nav").getElementsByClassName("prev")[0].classList.add("disabled");

	if ((current+1) < total) 
		document.getElementById("nav").getElementsByClassName("next")[0].classList.remove("disabled");	
}

function openTab(link)
{
	if(!link)
		link = accounts[cur_account].entries[accounts[cur_account].current].link; 
		
	addon.port.emit("click", link);
	return false;
}

function action(cmd)
{
	if(accounts[cur_account].count)
	{
		addon.port.emit("action", accounts[cur_account].entries[accounts[cur_account].current].link, cmd);
	}
}

function deleteCurrent()
{
	var account = accounts[cur_account];
	var current = account.current;
	
	if(account.count)
	{
		document.getElementById("content_mask").children[cur_account].children[current].classList.add("remove");
		
		
		if((current+1) == account.count)
			document.getElementById("content_mask").children[cur_account].style.left = '-' + width * (current-1) + 'px';
		
		account.count--;
		account.current = (current>0)? (current-1):0;
		
		account.entries.splice(current, 1);
		
		initNav();
		decMails(current);
	}
}

function decMails(mail_id)
{		
	addon.port.emit("decrease_mails", cur_account, mail_id);
}

function prettyDate(date_str){
	var time_formats = [
	[60, 'just now', 1], // 60
	[120, '1 minute ago', '1 minute from now'], // 60*2
	[3600, 'minutes', 60], // 60*60, 60
	[7200, '1 hour ago', '1 hour from now'], // 60*60*2
	[86400, 'hours', 3600], // 60*60*24, 60*60
	[172800, 'yesterday', 'tomorrow'], // 60*60*24*2
	[604800, 'days', 86400], // 60*60*24*7, 60*60*24
	[1209600, 'last week', 'next week'], // 60*60*24*7*4*2
	[2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
	[4838400, 'last month', 'next month'], // 60*60*24*7*4*2
	[29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
	[58060800, 'last year', 'next year'], // 60*60*24*7*4*12*2
	[2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
	[5806080000, 'last century', 'next century'], // 60*60*24*7*4*12*100*2
	[58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
	];
	var time = ('' + date_str).replace(/-/g,"/").replace(/[TZ]/g," ").replace(/^\s\s*/, '').replace(/\s\s*$/, '');
	if(time.substr(time.length-4,1)==".") time =time.substr(0,time.length-4);
	var seconds = (new Date - new Date(time)) / 1000;
	var token = 'ago', list_choice = 1;
	if (seconds < 0) {
		seconds = Math.abs(seconds);
		token = 'from now';
		list_choice = 2;
	}
	var i = 0, format;
	while (format = time_formats[i++]) 
		if (seconds < format[0]) {
			if (typeof format[2] == 'string')
				return format[list_choice];
			else
				return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
		}
	return time;
};