$(document).ready(function () {
	$('.next').on('click', function () {
		var current = $(this).data('currentBlock'),
			next = $(this).data('nextBlock');

		// only validate going forward. If current group is invalid, do not go further
		// .parsley().validate() returns validation result AND show errors
		if (next > current)
			if (false === $('#rsvp-form').parsley().validate('block' + current))
				return;

		// validation was ok. We can go on next step.
		$('.block' + current).hide();
		$('.block' + next).show();

	});

	$("input[name='entry.507744476']:radio").change(function () {
		if ($("input[name='entry.507744476']").filter(':checked').val() == 'yes')
			$('#guest_count').val(1).change();
		else
			$('#guest_count').val(0).change();
	});

	$('#guest_count').change(function () {
		var count = $(this).val();
		var guests = $('.guest');
		guests.each(function (i, guest) {
			if (i < count)
				$(guest).show();
			else
				$(guest).hide();
		});
	}).change();

	$('#rsvp-form').parsley({
		excluded: "input[type=button], input[type=submit], input[type=reset], input[type=hidden], :hidden",
		successClass: "has-success",
	    errorClass: "has-error",
		classHandler: function (el) {
			return el.$element.closest(".form-group");
		},
		errorsContainer: function (el) {
			return el.$element.closest(".form-group");
		},
	});

	$('#ss-submit').click(validateForm);
});

function validateForm(event) {
	if (event) event.preventDefault();

	$('#rsvp-form').parsley().validate();
}

function submitFormIframe(event) {
	if (event) event.preventDefault();

	// Let's create the iFrame used to send our data
	var iframe = document.createElement("iframe");
	iframe.name = "myTarget";
	iframe.style.display = "none";
	document.body.appendChild(iframe);

	// Define what should happen when the response is loaded
	iframe.addEventListener("load", function (data) {
		console.log(data);
		alert("Yeah! Data sent.");
		doSuccess();
	});

	var form = $('#rsvp-form');
	form.prop('target', iframe.name);

	form.submit();
}

function submitFormAjax(event) {
	// The submission works but we can't detect success because of CORS

	if (event) event.preventDefault();
	var action = 'http://fitzell.ca/forms/d/1w-INu_xopywyd8EWIuFBCoR3Oh9H8sfaDZew6wlIIpU/formResponse';
	var form = $('#rsvp-form');
	$.post(action, form.serialize())
		.done(doSuccess)
		.fail(function(e) { console.log(e) });
}

function doSuccess(data) {
	console.log('success!');
	$('#success').show();
	$('#rsvp-form').hide();
}