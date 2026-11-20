require "net/http"

# PostHog through our own domain (/ingest), so ad blockers, which block posthog.com and plenty of teenagers run, don't
# make people vanish from the onboarding funnel. /ingest/static/* is PostHog's script (from its assets host); the rest
# is events, flags and recordings (from its API host). See https://posthog.com/docs/advanced/proxy.
#
# Each request holds a Puma thread while PostHog answers. That's fine at manimator's size; past it, this belongs in a
# proxy in front of Rails.
class IngestController < ActionController::API
  FORWARDED_HEADERS = %w[Content-Type Content-Encoding User-Agent Origin].freeze
  RETURNED_HEADERS = %w[Content-Type Cache-Control Access-Control-Allow-Origin Access-Control-Allow-Credentials Access-Control-Allow-Headers Access-Control-Allow-Methods].freeze

  def forward
    upstream = self.class.upstream(params[:path], request.query_string)
    return head(:not_found) unless upstream

    response = Net::HTTP.start(upstream.host, upstream.port, use_ssl: upstream.scheme == "https", open_timeout: 5, read_timeout: 15) do |http|
      http.request(upstream_request(upstream))
    end
    RETURNED_HEADERS.each { |name| headers[name] = response[name] if response[name] }
    render body: response.body, status: response.code.to_i
  rescue Net::OpenTimeout, Net::ReadTimeout, SocketError, SystemCallError, OpenSSL::SSL::SSLError
    head :bad_gateway
  end

  # Where a path under /ingest goes at PostHog, or nil without PostHog configured. https://us.i.posthog.com's script
  # lives at https://us-assets.i.posthog.com.
  def self.upstream(path, query = nil)
    host = Rails.configuration.x.posthog_host.presence or return
    host = host.sub(".i.posthog.com", "-assets.i.posthog.com") if path.to_s.start_with?("static/")
    URI.join("#{host.chomp("/")}/", path.to_s).tap { |uri| uri.query = query.presence }
  end

  private
    def upstream_request(uri)
      klass = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "OPTIONS" => Net::HTTP::Options }.fetch(request.method)
      klass.new(uri).tap do |upstream|
        FORWARDED_HEADERS.each { |name| upstream[name] = request.headers[name] if request.headers[name] }
        # So PostHog places people by where they are, not where this server is.
        upstream["X-Forwarded-For"] = request.remote_ip
        upstream["Accept-Encoding"] = "identity"
        upstream.body = request.raw_post if upstream.request_body_permitted?
      end
    end
end
