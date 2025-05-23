import json
import time
from flask import Flask, request, jsonify, Response, send_file
from flask_cors import CORS 
import flask
from matplotlib import pyplot as plt
import numpy as np
import io, copy
from pydantic import ValidationError
import queue
from collections import OrderedDict


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}})

param_db_meta = OrderedDict([
    ('inline', {'name': 'Inline', 'widget': 'intslider', 'min': 0, 'max': 123}),
    ('crossline', {'name': 'Crossline', 'widget': 'intslider', 'min': 0, 'max': 123}),
    #('aperture',{'name':'Aperture', 'widget':'floatbox', 'min':0, 'max':1e7}),
    ('horizontal_offset', {'name': 'Horizontal offset', 'widget': 'floatslider', 'min': 0, 'max': 1000}),
    ('Vp', {'name': 'P Velocity', 'widget': 'floatslider', 'min': 1, 'max': 20000}),
    ('Vs', {'name': 'S Velocity', 'widget': 'floatslider', 'min': 1, 'max': 20000}),
])
param_db = {'inline':0,
            'crossline':0,
#            'aperture':1e6,
            'horizontal_offset':0,
            'Vp':2200,
            'Vs':900
            }

param_db_version = 0
current_image = None # This is a png image bytes object
image_update_clients = []


def validate_param(data):
    validated_data = {}
    for key, value in data.items():
        param_meta = param_db_meta.get(key) 

        if param_meta is None:
            raise ValueError(f"Parameter '{key}' does not exist in the metadata.")
        
        min_value = param_meta.get('min')
        max_value = param_meta.get('max')
        widget_type = param_meta.get('widget', '')

        # Determine expected type from widget
        if 'int' in widget_type:
            expected_type = int
        elif 'float' in widget_type:
            expected_type = (int, float)  # allow both int and float for floatslider/floatbox
        else:
            expected_type = (int, float)  # default safe assumption
        
        if not isinstance(value, expected_type):
            raise ValueError(f"Parameter '{key}' must be of type {expected_type if isinstance(expected_type, tuple) else expected_type.__name__}.")

        if min_value is not None and value < min_value:
            raise ValueError(f"Value for '{key}' must be greater than or equal to {min_value}.")
        
        if max_value is not None and value > max_value:
            raise ValueError(f"Value for '{key}' must be less than or equal to {max_value}.")
        
        validated_data[key] = value

    return validated_data


def notify_image_update_clients(event_data):
    print(f"Notify inage update client :{event_data}")
    for client_queue in image_update_clients:
        client_queue.put(event_data)

def generate_image(inline, horizontal_offset=0,
                   Vp=2200, Vs=900,
                   **kwargs):
    """This is a slow function which will be running in a separate 
    process in later versions"""
    
    #print(f'image generated with these parameter inline: {inline} aperture {aperture} ', )
    tic = time.time()
    global current_image
    plt.figure(figsize=(6,6))
    plt.plot(horizontal_offset,0,'.k')
    x = np.linspace(-1000,1000,500)
    z = np.linspace(0,-2000,500)
    X,Z = np.meshgrid(x,z)
    Y = np.zeros_like(X) + inline*10
    z_src = -1700
    x_rcv = horizontal_offset
    # Assume the receiver is at (0,0) and the source is at (0,z_src)
    Tshot = np.sqrt(X**2 + Y**2 + (Z-z_src)**2)/Vs
    Trcv = np.sqrt((X-horizontal_offset)**2 + Y**2 + (Z)**2)/Vp
    Tdirect = np.sqrt(z_src**2 + horizontal_offset**2)/Vp
    Lag = Tshot + Trcv - Tdirect
    print(f'Lag {Lag}')
    
    plt.contour(X,Z,Lag,extent=(-1000,1000,-2000,0),aspect=1,levels=np.linspace(0,0.1,10))
    #cs = plt.contourf(X, Z, Lag, extent=(-1000, 1000, -2000, 0), levels=np.linspace(0, 0.1, 10))
    plt.gca().set_aspect('equal') 
    plt.tight_layout()
    plt.colorbar()
    #plt.colorbar(cs)
    plt.title('Lag (seconds)')
    plt.xlabel('X (m)')
    plt.ylabel('Z (m)')
    current_image = io.BytesIO()
    plt.savefig(current_image, dpi=150, format='jpg')
    plt.close(plt.gcf())
    plt.clf()
    print(f"Elapsed image generate {time.time()-tic}") 


# Create a default image
generate_image(**param_db) 


@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({
        "status": "error",
        "message": str(e),
        "type": type(e).__name__
    }), 500

# Endpoint to list all parameters and their current values
# Note that the metadata can depend on the current value and can change.
@app.route('/param', methods=['GET'])
def list_keys():
    res = copy.copy(param_db_meta)
    for key,val in res.items():
        res[key]['value'] = param_db[key]
    return jsonify({
        "params": res,
        "order": list(res.keys())  
    }), 200

@app.route('/param/version', methods=['GET'])
def get_version():
    global param_db_version
    return jsonify({"version": param_db_version})

@app.route('/param/live-updates')
def stream_live_param_updates():
    def event_stream(client_queue):
        try:
            while True:
                event = client_queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except GeneratorExit:
            print('A client disconnected from live updates stream (GeneratorExit)')
        except Exception as e:
            print(f'Unexpected disconnection or error: {e}')
        finally:
            if client_queue in image_update_clients:
                image_update_clients.remove(client_queue)
                print(f'Client queue removed. Remaining clients: {len(image_update_clients)}')
    
    client_queue = queue.Queue()
    image_update_clients.append(client_queue)
    print(f"A new client subscribed to live param updates. Total clients: {len(image_update_clients)}")
    return Response(event_stream(client_queue), content_type='text/event-stream')


# Endpoint to get/put parameter values and also re-generate the current_image
@app.route('/param/<string:key>', methods=['GET','PUT'])
def param(key):
    try:
        if key not in param_db:
            return jsonify({
                "status": "failure",
                "message": f"Parameter {key} does not exist"
            }), 404

        if request.method == 'GET':
            return jsonify({key: param_db[key]}), 200

        elif request.method == 'PUT':
            print("PUT message is going on ")
            data = request.get_json()
            print(f"data {data}")

            if not data or key not in data:
                return jsonify({
                    "status": "failure",
                    "message": f"Missing or invalid payload for key '{key}'"
                }), 400
            
            try:
                validated_data = validate_param(data)
                print(f"Validation successful, validated data: {validated_data}")
            except ValueError as e: 
                print(f"Validation failed: {str(e)}")
                return jsonify({
                    "status": "failure",
                    "message": f"Validation failed: {str(e)}"
                }), 400

            newval = validated_data[key]
            if newval != param_db[key]:
                param_db[key] = newval
                global param_db_version
                param_db_version += 1
                try:
                    generate_image(**param_db)
                    notify_image_update_clients({
                        "event": "param_updated",
                        "param": key,
                        "new_value": param_db[key],
                        "version": param_db_version
                    })
                except Exception as e:
                    print(f"Image generation failed: {e}")

                return jsonify({
                    "status": "success",
                    "message": f"Parameter {key} updated",
                    "updated_value": param_db[key]
                }), 200
            else:
                print(f"No change detected in {key}.")
                return jsonify({
                    "status": "no_change",
                    "message": f"Parameter {key} already has the value {param_db[key]}"
                }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "type": type(e).__name__
        }), 500


# Serve the current_image
@app.route('/result.png', methods=['GET'])
def serve_result():
    if current_image is None:
        return jsonify({
        "status": "failure",
        "message": f"Image is not ready"
        }), 404
    else:
        image_copy = io.BytesIO(current_image.getvalue())
        image_copy.seek(0)
        return send_file(
            image_copy,
            download_name='result.png',
            mimetype='image/png'
    )

if __name__ == "__main__":
    app.run(debug=True)
