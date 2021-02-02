using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    private Vector3 moveSet;
    public bool has_been_moved;
    private Rigidbody2D player_rb;
    public float move_power = 10;
    public bool is_alive = true;
    public GameObject arrow_sprite;
    private GameObject arrow_obj = null;
    public float scale_modifier;
    private Vector3 arrow_scale_default;
    public GameObject death_effect;

    // Start is called before the first frame update
    void Start()
    {
        player_rb = gameObject.GetComponent<Rigidbody2D>();
        has_been_moved = false;
    }

    // Update is called once per frame
    void Update()
    {
        
    }
    private void OnTriggerEnter2D(Collider2D collision)
    {
        Debug.Log("Entered Trigger for Player");
        if (collision.CompareTag("Goal1") || collision.CompareTag("Goal2"))
        {
            Debug.Log("In Goal");
            //Destroy(gameObject);
            is_alive = false;
            player_rb.velocity = Vector3.zero;
            player_rb.simulated = false;
            gameObject.GetComponent<SpriteRenderer>().enabled = false;
            GameObject death_particle = Instantiate(death_effect,
                transform.position,
                new Quaternion(0, 90, 0, 0));
            Destroy(death_particle, death_effect.GetComponent<ParticleSystem>().main.duration);
        }
    }

    private void OnMouseDown()
    {
        Debug.Log("Game Object Selected");
        if (arrow_obj is null)
        {
            arrow_obj = Instantiate(arrow_sprite, transform.position, Quaternion.identity);
            arrow_scale_default = arrow_obj.transform.localScale;
        }
    }

    private void OnMouseDrag()
    {
        Vector3 mouse_location = Camera.main.ScreenToWorldPoint(Input.mousePosition);

        // Display Direction
        var radian = Mathf.Atan2((transform.position.y - mouse_location.y),
            (transform.position.x - mouse_location.x));
        var angle = (radian * (180 / Mathf.PI) + 270) % 360;
        arrow_obj.transform.eulerAngles = Vector3.forward * angle;

        // Indicate Power

        float mouse_distance = Vector3.Distance(transform.position, mouse_location) - 10;
        float move_power = mouse_distance * scale_modifier;
        if (move_power > 2f)
        {
            move_power = 2f;
        } else if (move_power < 1f) {
            move_power = 1f;
        }
        Debug.Log("move_power: " + move_power);
        arrow_obj.transform.localScale = arrow_scale_default * move_power;
    }

    private void OnMouseUp()
    {
        moveSet = Camera.main.ScreenToWorldPoint(Input.mousePosition);
        Debug.Log("Mouse Released at " + moveSet);
        has_been_moved = true;
    }

    public void ExecuteMove()
    {
        if (has_been_moved && is_alive)
        {
            Destroy(arrow_obj);
            arrow_obj = null;
            player_rb.AddForce((transform.position - moveSet) * move_power, ForceMode2D.Force);
            has_been_moved = false;
        }
    }
}
