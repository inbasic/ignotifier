window.addEventListener('message', function(event) {
	initList(event.data);
}, false);

function initList(list)
{
	var ul = $("#emails");
	ul.empty();

	list.forEach(function(obj, index) {
		add(obj.account, obj.count, obj.link, obj.entries, index);
	});
	
	//Select the first
	$("li:first > span", ul).trigger("click");
	
	//calculate the width of each mail previewer
	$("ul.email_holder").each(function(i, e){
		var num_of_mails = $(e).children().length;
		var width = $("li:first",e).width()+2;				
		$(e).css("width", (width*num_of_mails)+"px");
		
		if(num_of_mails == 1)
		{
			$(e).parent(".mask").next().addClass("disabled");
		}
	});
}

function add(account, count, link, entries, index) {
	var li = '<li><span onclick="showMail(this);">'+account+' (<span id="current_'+index+'">'+Math.min(1,count)+'</span>/<span id="total_'+index+'">'+count+'</span>) <i></i></span>'+
		'<div id="account_'+index+'" class="email_container">'+
			'<a href="" class="prev disabled" onclick="return prevMail('+index+');"><i></i></a>'+
			'<div class="mask">'+
				'<ul class="email_holder" id="holder_'+ index +'">';
		entries.forEach(function(e, i){
			li += '<li>'+
					'<div class="email_header">'+
						'<a href="mailto:'+e.author.email+'" title="'+e.author.email+'">'+e.author.name+'</a>'+
						'<span>'+formatDate(e.issued)+'</span>'+
					'</div>'+
					'<div class="email_content">'+
						'<a href="'+e.link.href+'" onclick="return openTab(this.href, '+index+', '+i+');" title="open this email">'+e.title+'</a>'+
						'<p>'+e.summary+'</p>'+
					'</div>'+
				'</li>';	
		});
			li += '</ul>'+
			'</div>'+
			'<a href="" class="next'+((!count)? " disabled": "")+'" onclick="return nextMail('+index+');"><i></i></a>'+
		'</div>'+
	'</li>';
	$("#emails").append(li);
}


function showMail(obj)
{
	if($(obj).next().css("display") == 'none' && parseInt($("[id^=total_]", obj).text())>0)
	{
		$(".email_container").slideUp(300);
		$("li.selected").removeClass("selected");
		
		$(obj).next().slideDown(300);
		$(obj).parent("li").addClass("selected");
	}
}

function prevMail(index)
{
	var current = parseInt($("#current_"+index).text());
	var total = parseInt($("#total_"+index).text());
	
	if(current > 1)
	{	
		var width = $("#holder_"+index+" li:first").width()+2;
		
		$("#holder_"+index).animate({'left':'-'+width*(current-2)+'px'},300);
		
		$("#current_"+index).text(--current);
	}
	
	if(current > 1)
		$("#account_"+index+" .prev").removeClass("disabled");
	else
		$("#account_"+index+" .prev").addClass("disabled");
		
	if(current < total)
		$("#account_"+index+" .next").removeClass("disabled");
	
	return false;
}

function nextMail(index)
{
	var current = parseInt($("#current_"+index).text());
	var total = parseInt($("#total_"+index).text());
	
	if(current < total)
	{			
		var width = $("#holder_"+index+" li:first").width()+2;
		
		$("#holder_"+index).animate({'left':'-'+width*current+'px'},300);
		
		$("#current_"+index).text(++current);
	}
	
	if(current < total)
		$("#account_"+index+" .next").removeClass("disabled");	
	else
		$("#account_"+index+" .next").addClass("disabled");
		
	if(current>1)
		$("#account_"+index+" .prev").removeClass("disabled");
	
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

function openTab(link, account_id, mail_id)
{
	var event = document.createEvent('CustomEvent');
    event.initCustomEvent("open_mail_link", true, true, {link:link, account_id: account_id, mail_id: mail_id});
    document.documentElement.dispatchEvent(event);
	
	return false;
}