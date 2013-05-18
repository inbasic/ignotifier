var ul, data;

HTMLCollection.prototype.forEach = Array.prototype.forEach


addon.port.on("list", function (arg) {
	initList(arg);
});


function initList(list)
{	
	ul = document.getElementById("emails");
	data = [];
	var mails_exist = false;
	
	clear();

	list.forEach(function(obj, index) {
		data[index] = { current: Math.min(1,obj.entries.length), total: obj.entries.length}; 
		
		if(!mails_exist && obj.entries.length>0)
			mails_exist = true;

		add(obj.account, obj.link, obj.entries, index);
	});
	
	
	if(mails_exist)
	{		
		//Select the first that exists
		var found = false;
		ul.children.forEach(function(e, i){
			if(data[i].total && !found)
			{
				e.firstChild.onclick();
				found = true;
			}
			else if(data[i].total == 0)
				e.firstChild.onclick = function(){};
		});
		
		
		var holders = document.getElementsByClassName("email_holder");
		var nexts = document.getElementsByClassName("next");
		var width = holders[0].offsetWidth;

		//calculate the width of each mail previewer
		holders.forEach(function(holder, i){
			holder.style.width = width * data[i].total;
			
			data[i].width = width;
			
			if(data[i].total <= 1)
			{
				nexts[i].classList.add("disabled");
			}
			
			//align rtl emails
			holder.children.forEach(function(li, j){
				var dir = window.getComputedStyle(li.getElementsByClassName("email_content")[0], null).direction;
	
				if(dir == "rtl")
					li.classList.add(dir);
			});
		});	
	}
}

function add(account, link, entries, index) {
	var li = '<li><span onclick="'+((data[index].total)? 'showMail(this, '+index+');' : 'openTab(\''+link+'\');' )+'">'+account+' (<span id="current_'+index+'">'+data[index].current+'</span>/<span id="total_'+index+'">'+data[index].total+'</span>) <i></i></span>'+
		'<div id="account_'+index+'" class="email_container slideUp">'+
			'<a href="" class="prev disabled" onclick="return prevMail('+index+');"><i></i></a>'+
			'<div class="mask">'+
				'<ul class="email_holder" id="holder_'+ index +'">';
		entries.forEach(function(e, i){
			li += '<li>'+
					'<div class="email_header">'+
						'<a href="mailto:'+e.author.email+'" onclick="return openTab(this.href);" title="'+e.author.email+'">'+e.author.name+'</a>'+
						'<span>'+formatDate(e.issued)+'</span>'+
					'</div>'+
					'<div class="email_content" dir="auto">'+
						'<a href="'+e.link.href+'" onclick="return openTab(this.href);">'+((typeof e.title == "string")? e.title: "(no subject)")+'</a>'+
						'<p>'+((typeof e.summary == "string")? e.summary: "(no body)")+'</p>'+
					'</div>'+
				'</li>';	
		});
			li += '</ul>'+
			'</div>'+
			'<a href="" class="next'+((!data[index].total)? " disabled": "")+'" onclick="return nextMail('+index+');"><i></i></a>'+
		'</div>'+
	'</li>';
	
	ul.innerHTML = ul.innerHTML + li;
}

function showMail(obj, index)
{
	if (!obj.nextSibling.classList.contains("slideDown") && data[index].total)
	{
		document.getElementsByClassName("slideDown").forEach(function(el, i){
			slideUp(el);	
		});
		
		ul.children.forEach(function(li, i){
			li.classList.remove("selected");	
		});

		slideDown(obj.nextSibling);
				
		obj.parentNode.classList.add("selected");
	}
}

function prevMail(index)
{
	var current = data[index].current;
	var total = data[index].total;
	var width = data[index].width;

	if (current > 1)
	{
		document.getElementById("holder_" + index).style.left = '-' + width * (current - 2) + 'px';

		document.getElementById("current_" + index).innerHTML = --current;
		
		data[index].current = current;
	}

	if (current > 1)
		document.getElementById("account_0").getElementsByClassName("prev")[0].classList.remove("disabled");
	else
		document.getElementById("account_0").getElementsByClassName("prev")[0].classList.add("disabled");

	if (current < total)
		document.getElementById("account_0").getElementsByClassName("next")[0].classList.remove("disabled");
	

	return false;
}

function nextMail(index)
{
	var current = data[index].current;
	var total = data[index].total;
	var width = data[index].width;

	if (current < total)
	{
		document.getElementById("holder_" + index).style.left = '-' + width * current + 'px';
		document.getElementById("current_" + index).innerHTML = ++current;
		
		data[index].current = current;
	}

	if (current < total) 
		document.getElementById("account_0").getElementsByClassName("next")[0].classList.remove("disabled");
	else
		document.getElementById("account_0").getElementsByClassName("next")[0].classList.add("disabled");

	if (current > 1) 
		document.getElementById("account_0").getElementsByClassName("prev")[0].classList.remove("disabled");

	return false;
}

function formatDate(str)
{
	var d = new Date(str);

	var month = d.getMonth()+1;
	var day = d.getDate();
	var hour = d.getHours();
	var minute = d.getMinutes();
	var second = d.getSeconds();
	
	var output = 
		((''+hour).length<2 ? '0' :'') + hour + ':' +
	    ((''+minute).length<2 ? '0' :'') + minute + ':' +
	    ((''+second).length<2 ? '0' :'') + second + ' '+
	    
	    ((''+month).length<2 ? '0' : '') + month + '-' +
	    ((''+day).length<2 ? '0' : '') + day + '-' +
		d.getFullYear();
	    
	    
	return output;
}

function openTab(link)
{
	addon.port.emit("open_mail", link);
	
	return false;
}

function decreasMails(account_id, mail_id)
{
    addon.port.emit("decrease_mails", {account_id: account_id, mail_id: mail_id});
}

function clear()
{
	while (ul.firstChild)
	{
		ul.removeChild(ul.firstChild);
	}
}

function slideDown(obj)
{
	obj.classList.remove("slideUp");
	obj.classList.add("slideDown");
}

function slideUp(obj)
{
	obj.classList.remove("slideDown");
	obj.classList.add("slideUp");
}