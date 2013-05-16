var ul = $("#emails");


function initSliders()
{
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

function showMail(obj)
{
	if($(obj).next().css("display") == 'none')
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
	
	if(current > 1)
	{	
		var width = $("#holder_"+index+" li:first").width()+2;
		
		$("#holder_"+index).animate({'left':'-'+width*(current-2)+'px'},300);
		
		$("#current_"+index).text(--current);
	}
	
	if(current > 1)
	{
		$("#account_"+index+" .next").removeClass("disabled");
		$("#account_"+index+" .prev").removeClass("disabled");
	}
	else
		$("#account_"+index+" .prev").addClass("disabled");
	
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
	{
		$("#account_"+index+" .next").removeClass("disabled");
		$("#account_"+index+" .prev").removeClass("disabled");
	}
	else
		$("#account_"+index+" .next").addClass("disabled");
		

	
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

function add(account, count, link, xml, index) {
	var li = '<li><span onclick="showMail(this);">'+account+' (<span id="current_'+index+'">1</span>/<span id="total_'+index+'">'+count+'</span>) <i></i></span>'+
		'<div id="account_'+index+'" class="email_container">'+
			'<a href="" class="prev disabled" onclick="return prevMail('+index+');"><i></i></a>'+
			'<div class="mask">'+
				'<ul class="email_holder" id="holder_'+ index +'">';
		xml.find("entry").each(function(i, e){
			e = $(e);
			li += '<li>'+
					'<div class="email_header">'+
						'<a href="mailto:'+e.find("author email").text()+'" title="'+e.find("author email").text()+'">'+e.find("author name").text()+'</a>'+
						'<span>'+formatDate(e.find("issued").text())+'</span>'+
					'</div>'+
					'<div class="email_content">'+
						'<a href="'+e.find("link").attr("href")+'" title="open this email">'+e.find("title").text()+'</a>'+
						'<p>'+e.find("summary").text()+'</p>'+
					'</div>'+
				'</li>';	
		});
			li += '</ul>'+
			'</div>'+
			'<a href="" class="next" onclick="return nextMail('+index+');"><i></i></a>'+
		'</div>'+
	'</li>';
	ul.append(li);
}


self.port.on("list", function(list) {
	ul.empty();
	list.forEach(function(obj, index) {
		
		obj.xml.enteries.forEach(function(entry, i)
		{
			console.log(entry.getElementsByTagName("id")[0].childNodes[0].nodeValue);
		});
		
		add(obj.account, obj.count, obj.link, $(obj.xml), index);
	});
	
	//initSliders();
});

ul.addEventListener("click", function(e) {
	console.log($("ul").toString());
	//self.port.emit('click', e.originalTarget.value);
})