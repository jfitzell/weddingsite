$(document).ready(function () {
	// Set up Parsley
	$('.step').each(function () {
		var stepId = $(this).data('step');
		$(this).find(':input').attr('data-parsley-group', stepId)
	});
	initializeParsley();

	// Hide inactive steps and hook up step navigation UI elements
	$('.step').slice(1).hide();
	$('.step-navigation').show();
	$('.next').click(changeStep);
	$('#ss-submit').click(submitFormAjax);
	$('.guest1')
		.find('.field-guest-first, .field-guest-last')
		.find('.control-label')
		.show();

	// Sync data between fields
	$("input[name='entry.507744476']:radio")
		.change(updateGuestCountFromAttendanceBoolean);
	$('#guest_count').change(adjustNumberOfGuestEntries).change();
	$('#user_first_dynamic, #user_last_dynamic').change(updateFirstGuestWithVisitorNames);

	// Focus the first field
	$('#rsvp-form :input').first().focus();
	
	$('.field-song input').typeahead({
			minLength: 3,
			highlight: true,
		},{
			source: function( query, callback ) {
				$.ajax({
					url: 'https://api.spotify.com/v1/search',
					data: {
						q: query,
						type: 'track'
					},
					success: function (response) {
						callback(uniqBy(response.tracks.items, trackNameAndArtists));
					}
				});
			},
			displayKey: trackNameAndArtists
		}
	).on('typeahead:selected', function(event, suggestion, dataset) {
		$('#song_spotify_id').val(suggestion.id);
	});
});

function trackNameAndArtists(suggestion) {
	return suggestion.name
		+ ' by '
		+ suggestion.artists.map(function (artist) { return artist.name }).join(', ');
}

function uniqBy(a, key) {
	var seen = {};
	return a.filter(function(item) {
		var k = key(item);
		return seen.hasOwnProperty(k) ? false : (seen[k] = true);
	})
}

function initializeParsley() {
	$('#rsvp-form').parsley({
		excluded: "input[type=button], input[type=submit], input[type=reset], input[type=hidden], :hidden",
		successClass: "has-success",
	    errorClass: "has-error",
		classHandler: function (el) {
			return el.$element.closest(".field");
		},
		errorsContainer: function (el) {
			return el.$element.closest(".field");
		},
		errorsWrapper: '<p class="help-block"></p>',
		errorTemplate: '<span></span>',
	});
}

function changeStep() {
	var form = $('#rsvp-form');
	var parsley = form.parsley();
	var steps = form.find('[data-step]');
	var current = $(this).closest('[data-step]');
	var nextId = $(this).data('next-step');
	var next = form.find('[data-step=' + nextId + ']');

	// only validate going forward. If current group is invalid, do not go further
	// .parsley().validate() returns validation result AND show errors
	if (steps.index(next) > steps.index(current))
		if (false === parsley.validate(current.data('step')))
			return;

	// validation was ok. We can go on next step.
	steps.hide();
	parsley.reset();
	next.show();
	next.find(':input').first().focus();
}

function adjustNumberOfGuestEntries() {
	var guests_select = $('#guest_count')
	var count = guests_select.val() || 0;
	var guests = $('.guest');
	guests.each(function (i, guest) {
		if (i < count)
			$(guest).show();
		else
			$(guest).hide();
	});

	if (guests_select.is(':focus')) {
		var inputs = guests_select.closest('.step').find(':input');
		inputs.eq( inputs.index(guests_select) + 1 ).focus();
	}
}

function updateFirstGuestWithVisitorNames() {
	$('#user_first_static').text($('#user_first_dynamic').val());
	$('#user_last_static').text($('#user_last_dynamic').val());
}

function updateGuestCountFromAttendanceBoolean() {
	if ($('.field-attending input:radio').filter(':checked').val() == 'yes')
		$('#guest_count').val(1).change();
	else
		$('#guest_count').val(0).change();
}

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
	if (event) event.preventDefault();
	var form = $('#rsvp-form');
	// We have to send the request via a proxy to make CORS work
	var action = $('#rsvp-form').prop('action').replace(/https?:\/\/docs.google.com/, 'http://fitzell.ca');
	$.post(action, form.serialize())
		.done(doSuccess)
		.fail(function(e) { doFailure(e) });
}

function doSuccess(data) {
	console.log('success!');
	$('#success').show();
	$('#rsvp-form').hide();
}

function doFailure(error) {
	console.log(error)
}